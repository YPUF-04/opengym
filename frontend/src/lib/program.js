// The coach's program builder (views/ProgramWizard.jsx). No AI and no server: a few answers
// (goal, level, days a week, time per session, equipment, the dumbbells you own) become a
// complete weekly program of ordinary routines, with only exercises your equipment allows.
//
// It then grows with you. Every phase lasts about ten weeks; when one is over the coach asks to
// refresh the program (one more exercise per session, a little more volume), and at six months it
// offers the next stage (one more training day and a split instead of full-body sessions).
//
//   S.program = { answers, phase, createdAt (iso), start (iso of phase 1), routineIds, snoozeUntil }
//
// Pure: everything returns new values; the screen writes them into the store.
import { uid } from './format.js'
import { EXIDX } from './exercises.js'
import { eqAvailable } from './equipment.js'

// Each movement, best choice first. The first one the equipment allows is used, so a gym gets
// the barbell squat and a flat with two dumbbells and a bench gets the goblet squat.
export const PATTERNS = {
  squat: ['0043', '1760', '1197'],
  hinge: ['0032', '1459', '0432', '4791'],
  lunge: ['2290', '0336', '0612'],
  glute: ['4742', '4791'],
  pushH: ['0025', '0289', '0662'],
  pushI: ['0314', '0493', '0662'],
  fly: ['0308', '0319'],
  pushV: ['0426', '0405'],
  pullH: ['0861', '0027', '0327', '0293', '0499', '3436'],
  pullV: ['0652', '2330', '1236', '0293'],
  rear: ['2487', '0380'],
  lateral: ['0334'],
  biceps: ['0294', '0313', '0297'],
  triceps: ['0351', '2188', '0333', '0129', '0814'],
  core: ['0463', '4727', '0276', '1163'],
  calves: ['0417', '3390'],
  cardio: ['0630', '3094', '1160'],
}

// The sessions of each split, as movements in order of importance; a short session keeps the top.
const SESSIONS = {
  fullA: ['squat', 'pushH', 'pullH', 'hinge', 'lateral', 'core', 'biceps', 'triceps'],
  fullB: ['hinge', 'pushI', 'pullV', 'lunge', 'pushV', 'core', 'triceps', 'calves'],
  fullC: ['lunge', 'pushH', 'pullH', 'glute', 'rear', 'core', 'biceps', 'cardio'],
  upperA: ['pushH', 'pullH', 'pushV', 'pullV', 'lateral', 'biceps', 'triceps', 'core'],
  lowerA: ['squat', 'hinge', 'lunge', 'glute', 'calves', 'core', 'cardio'],
  upperB: ['pushI', 'pullV', 'fly', 'pullH', 'rear', 'triceps', 'biceps', 'core'],
  lowerB: ['hinge', 'lunge', 'squat', 'glute', 'calves', 'core', 'cardio'],
  push: ['pushH', 'pushI', 'pushV', 'fly', 'lateral', 'triceps', 'core'],
  pull: ['pullV', 'pullH', 'rear', 'biceps', 'core', 'cardio'],
  legs: ['squat', 'hinge', 'lunge', 'glute', 'calves', 'core'],
}

const NAMES = {
  fullA: 'Full Body A', fullB: 'Full Body B', fullC: 'Full Body C',
  upperA: 'Upper A', lowerA: 'Lower A', upperB: 'Upper B', lowerB: 'Lower B',
  push: 'Push', pull: 'Pull', legs: 'Legs',
}
const GLYPH = { fullA: 'figureStrength', fullB: 'figureStrength', fullC: 'figureStrength', upperA: 'arm', upperB: 'arm', lowerA: 'legs', lowerB: 'legs', push: 'arm', pull: 'pullup', legs: 'legs' }

// Weekdays (Date#getDay) for each number of training days, rest days spread out.
export const DAYS_FOR = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] }

/** Which sessions a week holds: full body up to 3 days (or in phase 1-2 for a beginner), splits after. */
export function splitFor(days, level, phase = 1) {
  const fullOnly = days <= 3 || (level === 'new' && phase < 3 && days <= 4)
  if (fullOnly) return ['fullA', 'fullB', 'fullC', 'fullA'].slice(0, Math.max(2, days))
  if (days === 4) return ['upperA', 'lowerA', 'upperB', 'lowerB']
  if (days === 5) return ['upperA', 'lowerA', 'push', 'pull', 'legs']
  return ['push', 'pull', 'legs', 'push', 'pull', 'legs']
}

/** Exercises per session from the time you have, one more each phase (to a ceiling). */
export function exerciseCount(minutes, phase = 1, extra = 0) {
  const base = minutes <= 30 ? 4 : minutes <= 45 ? 5 : 6
  return Math.min(8, base + Math.min(2, phase - 1) + extra)
}

/** Sets and reps for the goal and level; later phases add a set to the first movements. */
export function dose(goal, level, phase = 1) {
  const sets = (level === 'new' ? 2 : 3) + (phase >= 2 ? 1 : 0)
  const reps = goal === 'lose' ? 15 : goal === 'gain' ? 10 : 12
  return { sets: Math.min(5, sets), reps }
}

/** The first exercise of a movement that the equipment allows, skipping ones already used. */
export function pick(pattern, equipment, used = new Set()) {
  for (const id of PATTERNS[pattern] || []) {
    const ex = EXIDX[id]
    if (ex && !used.has(id) && eqAvailable(equipment, ex)) return id
  }
  return null
}

/** The starting weight for an exercise: your lightest owned dumbbell on dumbbell work, else 0. */
const startWeight = (id, dumbbells) => (EXIDX[id]?.eq === 'dumbbell' && dumbbells?.length ? Math.min(...dumbbells) : 0)

/**
 * The program for a set of answers: { routines, schedule: [[weekday, routineId]], summary }.
 * Routines have the same shape as everywhere else ({ id, name, emoji, ex: [{ id, sets, reps, weight }] }).
 */
export function buildProgram(answers, phase = 1, makeId = uid, label = x => x) {
  const { goal = 'keep', level = 'new', days = 3, minutes = 45, equipment = [], dumbbells = [], extra = 0 } = answers || {}
  const d = Math.min(6, Math.max(2, Math.round(days)))
  const sessions = splitFor(d, level, phase)
  const n = exerciseCount(minutes, phase, extra)
  const { sets, reps } = dose(goal, level, phase)
  const byKey = {}
  const routines = []
  for (const key of sessions) {
    if (byKey[key]) continue
    const used = new Set()
    const ex = []
    for (const pattern of SESSIONS[key]) {
      if (ex.length >= n) break
      const id = pick(pattern, equipment, used)
      if (!id) continue
      used.add(id)
      const holds = id === '0463'
      ex.push({ id, sets: ex.length < 2 ? sets : Math.max(2, sets - 1), reps: holds ? 30 : pattern === 'cardio' ? 20 : reps, weight: startWeight(id, dumbbells) })
    }
    const r = { id: makeId(), name: label(NAMES[key]), emoji: GLYPH[key], ex, program: true }
    byKey[key] = r
    routines.push(r)
  }
  const schedule = DAYS_FOR[d].map((day, i) => [day, byKey[sessions[i]].id])
  return { routines, schedule, summary: { days: d, split: sessions[0].startsWith('full') ? 'full' : d === 4 ? 'upperlower' : 'split', perSession: n, sets, reps, phase } }
}

const DAY = 86400000
const isoDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / DAY)

export const PHASE_DAYS = 70       // about ten weeks a phase
export const LEVEL_UP_DAYS = 182   // about six months

/**
 * What the coach wants to ask today, if anything:
 *   { kind: 'refresh' }                       a phase is over: a fresh program, a bit more
 *   { kind: 'level-up', days, from }          six months in: one more day a week and a split
 * Nothing while snoozed.
 */
export function reviewDue(program, today) {
  if (!program?.createdAt) return null
  if (program.snoozeUntil && today < program.snoozeUntil) return null
  const sinceStart = isoDays(program.start || program.createdAt, today)
  const sincePhase = isoDays(program.createdAt, today)
  const days = program.answers?.days || 3
  if (sinceStart >= LEVEL_UP_DAYS && !program.leveledUp && days < 6) return { kind: 'level-up', from: days, days: days + 1 }
  if (sincePhase >= PHASE_DAYS) return { kind: 'refresh' }
  return null
}

/** The date of the next check-in, for "next check: 12 January". */
export function nextCheck(program) {
  if (!program?.createdAt) return null
  const d = new Date(program.createdAt + 'T12:00:00')
  d.setDate(d.getDate() + PHASE_DAYS)
  return d.toISOString().slice(0, 10)
}

/**
 * Writes a built program into the state copy `s`: the routines of the previous program go (your
 * own routines stay), the new ones take their weekdays, and S.program records it all.
 */
export function applyProgram(s, answers, built, today, { phase = 1, start, leveledUp } = {}) {
  const old = new Set(s.program?.routineIds || [])
  s.routines = (s.routines || []).filter(r => !old.has(r.id)).concat(built.routines)
  const week = { ...(s.week || {}) }
  for (const k of Object.keys(week)) {
    const list = (Array.isArray(week[k]) ? week[k] : [week[k]]).filter(id => id && !old.has(id))
    if (list.length) week[k] = list; else delete week[k]
  }
  for (const [day, id] of built.schedule) week[day] = [id]
  s.week = week
  s.program = {
    answers: { ...answers }, phase, createdAt: today, start: start || today,
    routineIds: built.routines.map(r => r.id), snoozeUntil: null, leveledUp: !!leveledUp,
  }
  return s
}
