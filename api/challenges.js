// Challenges between the people on one instance (Gearly): "who does the most push-ups this
// week", "longest plank", "most steps". Someone creates one and gets a six-character code;
// friends join with the code and log what they did; everyone sees the same leaderboard.
//
// Stored in db.json as db.challenges. Every function here is pure over that list (it returns the
// changed challenge or an error string), so server.js only loads, calls and saves.
//
//   { id, code, name, kind, unit, mode: 'total'|'best', start (ms), end (ms), owner (uid),
//     members: [uid], entries: [{ id, uid, value, at (ms) }] }

import crypto from 'node:crypto';

// The ready-made kinds. `mode` says how a member's score is counted: the sum of what they logged,
// or their single best entry (a plank is held once, not added up).
export const KINDS = {
  pushups: { unit: 'reps', mode: 'total', max: 2000 },
  squats: { unit: 'reps', mode: 'total', max: 3000 },
  situps: { unit: 'reps', mode: 'total', max: 3000 },
  pullups: { unit: 'reps', mode: 'total', max: 1000 },
  plank: { unit: 'sec', mode: 'best', max: 3600 },
  steps: { unit: 'steps', mode: 'total', max: 100000 },
  workouts: { unit: 'count', mode: 'total', max: 5 },
  custom: { unit: 'reps', mode: 'total', max: 100000 },
};

export const MAX_DAYS = 90;
export const MAX_MEMBERS = 50;
export const MAX_JOINED = 20;
export const MAX_ENTRIES = 5000;
// No 0/O or 1/I, so a code read out loud or off a screen is typed right.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 86400000;

export function newCode(taken, rand = crypto.randomInt) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += ALPHABET[rand(ALPHABET.length)];
    if (!taken.has(c)) return c;
  }
}

export const cleanCode = v => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

const text = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);

/** A new challenge, or { error }. */
export function create(list, uid, body, now = Date.now(), rand) {
  const kind = Object.hasOwn(KINDS, body?.kind) ? body.kind : null;
  if (!kind) return { error: 'unknown kind' };
  const days = Math.round(Number(body.days));
  if (!(days >= 1 && days <= MAX_DAYS)) return { error: 'days must be 1 to ' + MAX_DAYS };
  if (list.filter(c => c.members.includes(uid) && c.end > now).length >= MAX_JOINED) return { error: 'too many challenges' };
  const name = text(body.name, 60);
  if (!name) return { error: 'name required' };
  const k = KINDS[kind];
  const code = newCode(new Set(list.map(c => c.code)), rand);
  return {
    challenge: {
      id: crypto.randomUUID(), code, name, kind, unit: k.unit, mode: k.mode,
      start: now, end: now + days * DAY, owner: uid, members: [uid], entries: [],
    },
  };
}

/** Adds `uid` to the challenge with `code`; { challenge } or { error }. */
export function join(list, uid, code, now = Date.now()) {
  const c = list.find(x => x.code === cleanCode(code));
  if (!c) return { error: 'no such code' };
  if (c.members.includes(uid)) return { challenge: c };
  if (c.end <= now) return { error: 'this challenge has ended' };
  if (c.members.length >= MAX_MEMBERS) return { error: 'this challenge is full' };
  if (list.filter(x => x.members.includes(uid) && x.end > now).length >= MAX_JOINED) return { error: 'too many challenges' };
  c.members.push(uid);
  return { challenge: c };
}

/** Logs `value` for `uid`; { challenge } or { error }. */
export function addEntry(list, uid, id, value, now = Date.now()) {
  const c = list.find(x => x.id === id);
  if (!c || !c.members.includes(uid)) return { error: 'not in this challenge' };
  if (now > c.end) return { error: 'this challenge has ended' };
  const v = Math.round(Number(value));
  const max = (KINDS[c.kind] || KINDS.custom).max;
  if (!(v >= 1 && v <= max)) return { error: 'value must be 1 to ' + max };
  if (c.entries.length >= MAX_ENTRIES) return { error: 'too many entries' };
  c.entries.push({ id: crypto.randomUUID(), uid, value: v, at: now });
  return { challenge: c };
}

/** Takes back one of your own entries; { challenge } or { error }. */
export function removeEntry(list, uid, id, entryId) {
  const c = list.find(x => x.id === id);
  if (!c) return { error: 'not in this challenge' };
  const e = c.entries.find(x => x.id === entryId);
  if (!e || e.uid !== uid) return { error: 'not your entry' };
  c.entries = c.entries.filter(x => x.id !== entryId);
  return { challenge: c };
}

/**
 * Leaves a challenge. The owner leaving deletes it for everyone, so a challenge never sits there
 * with nobody able to look after it. Returns the new list.
 */
export function leave(list, uid, id) {
  const c = list.find(x => x.id === id);
  if (!c || !c.members.includes(uid)) return list;
  if (c.owner === uid) return list.filter(x => x.id !== id);
  c.members = c.members.filter(m => m !== uid);
  c.entries = c.entries.filter(e => e.uid !== uid);
  return list;
}

/** Each member's score, best first; ties share a place. */
export function leaderboard(c, nameOf = uid => uid) {
  const rows = c.members.map(uid => {
    const mine = c.entries.filter(e => e.uid === uid).map(e => e.value);
    const score = c.mode === 'best' ? (mine.length ? Math.max(...mine) : 0) : mine.reduce((s, v) => s + v, 0);
    return { uid, name: nameOf(uid), score, entries: mine.length };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let place = 0, last = null;
  rows.forEach((r, i) => { if (r.score !== last) { place = i + 1; last = r.score; } r.place = place; });
  return rows;
}

/** What one member sees of a challenge: the board, their own entries, never other ids. */
export function view(c, uid, nameOf, now = Date.now()) {
  return {
    id: c.id, code: c.code, name: c.name, kind: c.kind, unit: c.unit, mode: c.mode,
    start: c.start, end: c.end, ended: now > c.end, mine: c.owner === uid,
    board: leaderboard(c, nameOf).map(r => ({ name: r.name, score: r.score, entries: r.entries, place: r.place, me: r.uid === uid })),
    today: c.entries.filter(e => e.uid === uid && now - e.at < DAY).map(e => ({ id: e.id, value: e.value, at: e.at })),
  };
}

/** The challenges `uid` is in, newest first; ended ones are kept for 30 days to look back at. */
export function mine(list, uid, now = Date.now()) {
  return list.filter(c => c.members.includes(uid) && c.end + 30 * DAY > now).sort((a, b) => b.start - a.start);
}

/** Drops challenges that ended more than 30 days ago and the entries of deleted accounts. */
export function prune(list, userIds, now = Date.now()) {
  const alive = new Set(userIds);
  return list.filter(c => c.end + 30 * DAY > now && alive.has(c.owner)).map(c => {
    c.members = c.members.filter(m => alive.has(m));
    c.entries = c.entries.filter(e => alive.has(e.uid));
    return c;
  });
}
