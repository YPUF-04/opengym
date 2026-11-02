import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, join, addEntry, removeEntry, leave, leaderboard, view, mine, prune, newCode, cleanCode, MAX_MEMBERS } from '../challenges.js';

const T0 = Date.UTC(2026, 10, 1);
const DAY = 86400000;

function setup() {
  const list = [];
  const { challenge } = create(list, 'a', { kind: 'pushups', days: 7, name: 'Push-up week' }, T0);
  list.push(challenge);
  return { list, c: challenge };
}

test('create checks the kind, the length and the name', () => {
  assert.equal(create([], 'a', { kind: 'nope', days: 7, name: 'x' }).error, 'unknown kind');
  assert.match(create([], 'a', { kind: 'pushups', days: 0, name: 'x' }).error, /days/);
  assert.match(create([], 'a', { kind: 'pushups', days: 400, name: 'x' }).error, /days/);
  assert.equal(create([], 'a', { kind: 'pushups', days: 7, name: '  ' }).error, 'name required');
  const { c } = setup();
  assert.equal(c.code.length, 6);
  assert.deepEqual(c.members, ['a']);
  assert.equal(c.end - c.start, 7 * DAY);
  assert.equal(c.mode, 'total');
});

test('codes avoid look-alike characters and never repeat', () => {
  let i = 0;
  const rand = () => (i++ < 6 ? 0 : 1); // first draw AAAAAA (taken), then BBBBBB
  assert.equal(newCode(new Set(['AAAAAA']), rand), 'BBBBBB');
  assert.equal(cleanCode(' ab-c12 3x '), 'ABC123');
});

test('join by code, once, until it ends or fills', () => {
  const { list, c } = setup();
  assert.equal(join(list, 'b', c.code.toLowerCase(), T0).challenge, c);
  join(list, 'b', c.code, T0);
  assert.deepEqual(c.members, ['a', 'b']);
  assert.equal(join(list, 'z', 'ZZZZZZ', T0).error, 'no such code');
  assert.equal(join(list, 'c', c.code, T0 + 8 * DAY).error, 'this challenge has ended');
  for (let k = c.members.length; k < MAX_MEMBERS; k++) c.members.push('m' + k);
  assert.equal(join(list, 'late', c.code, T0).error, 'this challenge is full');
});

test('entries: members only, bounded, before the end; your own can be taken back', () => {
  const { list, c } = setup();
  assert.equal(addEntry(list, 'b', c.id, 10, T0).error, 'not in this challenge');
  assert.match(addEntry(list, 'a', c.id, 0, T0).error, /value/);
  assert.match(addEntry(list, 'a', c.id, 99999, T0).error, /value/);
  assert.equal(addEntry(list, 'a', c.id, 10, T0 + 8 * DAY).error, 'this challenge has ended');
  addEntry(list, 'a', c.id, 25, T0 + 1000);
  join(list, 'b', c.code, T0);
  const eB = addEntry(list, 'b', c.id, 30, T0 + 2000).challenge.entries.at(-1);
  assert.equal(removeEntry(list, 'a', c.id, eB.id).error, 'not your entry');
  assert.ok(removeEntry(list, 'b', c.id, eB.id).challenge);
  assert.equal(c.entries.length, 1);
});

test('leaderboard: total or best, ties share a place', () => {
  const { list, c } = setup();
  join(list, 'b', c.code, T0); join(list, 'c', c.code, T0);
  addEntry(list, 'a', c.id, 20, T0); addEntry(list, 'a', c.id, 20, T0);
  addEntry(list, 'b', c.id, 40, T0);
  const names = { a: 'Ali', b: 'Berk', c: 'Can' };
  const board = leaderboard(c, u => names[u]);
  assert.deepEqual(board.map(r => [r.name, r.score, r.place]), [['Ali', 40, 1], ['Berk', 40, 1], ['Can', 0, 3]]);
  c.mode = 'best';
  assert.deepEqual(leaderboard(c, u => names[u]).map(r => [r.name, r.score]), [['Berk', 40], ['Ali', 20], ['Can', 0]]);
});

test('view hides ids and shows only your own entries of the last day', () => {
  const { list, c } = setup();
  join(list, 'b', c.code, T0);
  addEntry(list, 'a', c.id, 15, T0); addEntry(list, 'b', c.id, 5, T0);
  const v = view(c, 'b', u => u.toUpperCase(), T0 + 1000);
  assert.equal(v.mine, false);
  assert.deepEqual(v.board.map(r => [r.name, r.me]), [['A', false], ['B', true]]);
  assert.equal(v.today.length, 1);
  assert.equal(v.today[0].value, 5);
  assert.equal(JSON.stringify(v).includes('"uid"'), false);
});

test('leave: a member goes with their entries, the owner deletes it', () => {
  const { list, c } = setup();
  join(list, 'b', c.code, T0); addEntry(list, 'b', c.id, 5, T0);
  let out = leave(list, 'b', c.id);
  assert.deepEqual(c.members, ['a']); assert.equal(c.entries.length, 0);
  out = leave(out, 'a', c.id);
  assert.equal(out.length, 0);
});

test('mine and prune keep ended challenges for 30 days', () => {
  const { list } = setup();
  assert.equal(mine(list, 'a', T0 + 20 * DAY).length, 1);
  assert.equal(mine(list, 'a', T0 + 40 * DAY).length, 0);
  assert.equal(prune(list, ['a'], T0 + 40 * DAY).length, 0);
  assert.equal(prune(list, ['b'], T0).length, 0); // owner deleted
});
