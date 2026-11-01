/* Challenges over HTTP: two signed-in users, one creates a push-up week, the other joins with
   the code, both log reps, both see the same board; strangers see nothing. Same harness as
   server-email.test.js (a real server.js on a temp DATA_DIR, sessions minted with its secret). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ORIGIN = 'http://localhost:8080';
const session = uid => {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return 'gymsid=' + payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};

async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-ch-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  const users = [{ id: 'ua', name: 'Ali' }, { id: 'ub', name: 'Berk' }, { id: 'uc', name: 'Can' }];
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds: [], subs: [], invites: [] }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', INVITE_ONLY: '', ADMIN_UIDS: '' },
  });
  let log = '';
  child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const api = `http://127.0.0.1:${await boundPort(child, () => log)}`;
  const req = async (method, p, uid, body) => {
    const r = await fetch(api + p, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', ...(uid ? { Cookie: session(uid) } : {}) },
    });
    return { status: r.status, body: await r.json() };
  };
  return { req, dataDir };
}

test('a push-up week between friends, end to end', async t => {
  const { req, dataDir } = await startServer(t);
  assert.equal((await req('GET', '/api/challenges')).status, 401);

  const made = await req('POST', '/api/challenges/create', 'ua', { kind: 'pushups', days: 7, name: 'Şınav haftası' });
  assert.equal(made.status, 200);
  assert.match(made.body.code, /^[A-HJ-NP-Z2-9]{6}$/);

  assert.equal((await req('POST', '/api/challenges/join', 'ub', { code: 'ZZZZZZ' })).status, 404);
  assert.equal((await req('POST', '/api/challenges/join', 'ub', { code: made.body.code.toLowerCase() })).status, 200);

  assert.equal((await req('POST', '/api/challenges/entry', 'ua', { id: made.body.id, value: 30 })).status, 200);
  assert.equal((await req('POST', '/api/challenges/entry', 'ub', { id: made.body.id, value: 45 })).status, 200);
  assert.equal((await req('POST', '/api/challenges/entry', 'uc', { id: made.body.id, value: 99 })).status, 400);
  assert.equal((await req('POST', '/api/challenges/entry', 'ua', { id: made.body.id, value: 0 })).status, 400);

  const seenByA = (await req('GET', '/api/challenges', 'ua')).body.challenges;
  assert.equal(seenByA.length, 1);
  assert.deepEqual(seenByA[0].board.map(r => [r.name, r.score, r.place, r.me]), [['Berk', 45, 1, false], ['Ali', 30, 2, true]]);
  assert.equal(seenByA[0].mine, true);
  assert.equal(seenByA[0].today.length, 1);
  assert.equal((await req('GET', '/api/challenges', 'uc')).body.challenges.length, 0);

  // Berk takes his entry back, then leaves; it survives a restart of the data file.
  const berk = (await req('GET', '/api/challenges', 'ub')).body.challenges[0];
  assert.equal((await req('POST', '/api/challenges/entry', 'ub', { id: berk.id, remove: berk.today[0].id })).status, 200);
  assert.equal((await req('POST', '/api/challenges/leave', 'ub', { id: berk.id })).status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.deepEqual(saved.challenges[0].members, ['ua']);
  assert.equal(saved.challenges[0].entries.length, 1);
});
