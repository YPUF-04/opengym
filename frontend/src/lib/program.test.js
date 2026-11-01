import { describe, it, expect } from 'vitest'
import { PATTERNS, buildProgram, splitFor, exerciseCount, dose, pick, reviewDue, applyProgram, nextCheck, DAYS_FOR } from './program.js'
import { EXIDX } from './exercises.js'
import { eqAvailable, accessoriesOf } from './equipment.js'

const HOME = ['dumbbell', 'bench']   // two 5 kg dumbbells and a bench
let n = 0
const id = () => 'r' + (++n)

describe('program builder', () => {
  it('every candidate exercise exists in the catalogue', () => {
    for (const [p, ids] of Object.entries(PATTERNS)) for (const x of ids) expect(EXIDX[x], p + ' ' + x).toBeTruthy()
  })

  it('dumbbells and a bench: only exercises you can do, starting at your 5 kg', () => {
    const { routines, schedule, summary } = buildProgram({ goal: 'keep', level: 'new', days: 3, minutes: 45, equipment: HOME, dumbbells: [5] }, 1, id)
    expect(summary.split).toBe('full')
    expect(schedule.map(([d]) => d)).toEqual([1, 3, 5])
    for (const r of routines) {
      expect(r.ex.length).toBe(5)
      for (const e of r.ex) {
        const ex = EXIDX[e.id]
        expect(eqAvailable(HOME, ex), ex.n).toBe(true)
        expect(['dumbbell', 'body weight']).toContain(ex.eq)
        expect(accessoriesOf(ex).every(a => HOME.includes(a)), ex.n).toBe(true)
        expect(e.weight).toBe(ex.eq === 'dumbbell' ? 5 : 0)
      }
    }
    // the goblet squat, not the barbell one; the bench press on the bench
    expect(routines[0].ex[0].id).toBe('1760')
    expect(routines[0].ex[1].id).toBe('0289')
  })

  it('nothing at all: a body-weight program', () => {
    const { routines } = buildProgram({ days: 2, minutes: 30, equipment: [] }, 1, id)
    for (const r of routines) for (const e of r.ex) expect(EXIDX[e.id].eq).toBe('body weight')
    expect(routines.length).toBe(2)
  })

  it('a full gym gets the barbell lifts and a split at 4+ days', () => {
    const gym = ['barbell', 'olympic barbell', 'bench', 'pull-up bar', 'cable', 'dumbbell', 'leverage machine']
    const p = buildProgram({ level: 'some', days: 4, minutes: 60, equipment: gym }, 1, id)
    expect(p.routines.map(r => r.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(p.routines[1].ex[0].id).toBe('0043')
  })

  it('splits, counts and doses grow with the phase', () => {
    expect(splitFor(3, 'new')).toEqual(['fullA', 'fullB', 'fullC'])
    expect(splitFor(4, 'new', 1)[0]).toBe('fullA')
    expect(splitFor(4, 'new', 3)[0]).toBe('upperA')
    expect(splitFor(6, 'some')).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs'])
    expect(exerciseCount(30)).toBe(4)
    expect(exerciseCount(30, 2)).toBe(5)
    expect(exerciseCount(60, 9, 9)).toBe(8)
    expect(dose('lose', 'new')).toEqual({ sets: 2, reps: 15 })
    expect(dose('gain', 'some', 2)).toEqual({ sets: 4, reps: 10 })
    expect(Object.keys(DAYS_FOR).map(Number)).toEqual([2, 3, 4, 5, 6])
  })

  it('pick skips exercises already in the session', () => {
    expect(pick('pushH', HOME)).toBe('0289')
    expect(pick('pushH', HOME, new Set(['0289']))).toBe('0662')
  })
})

describe('the coach asks at the right time', () => {
  const p = { createdAt: '2026-01-01', start: '2026-01-01', answers: { days: 3 } }
  it('refresh after ten weeks, level up at six months, not while snoozed', () => {
    expect(reviewDue(p, '2026-02-15')).toBe(null)
    expect(reviewDue(p, '2026-03-15')).toEqual({ kind: 'refresh' })
    expect(reviewDue({ ...p, snoozeUntil: '2026-03-20' }, '2026-03-15')).toBe(null)
    expect(reviewDue({ ...p, createdAt: '2026-06-01' }, '2026-07-05')).toEqual({ kind: 'level-up', from: 3, days: 4 })
    expect(reviewDue({ ...p, createdAt: '2026-06-01', leveledUp: true }, '2026-07-05')).toBe(null)
    expect(nextCheck(p)).toBe('2026-03-12')
  })
})

describe('applying a program', () => {
  it('replaces the old program, keeps your own routines and other days', () => {
    const s = { routines: [{ id: 'mine', name: 'My stuff', ex: [] }], week: { 0: ['mine'] } }
    const first = buildProgram({ days: 3, equipment: HOME }, 1, id)
    applyProgram(s, { days: 3 }, first, '2026-01-01')
    expect(s.routines.length).toBe(4)
    expect(s.week[1]).toEqual([first.routines[0].id])
    expect(s.week[0]).toEqual(['mine'])
    const second = buildProgram({ days: 2, equipment: HOME }, 2, id)
    applyProgram(s, { days: 2 }, second, '2026-03-15', { phase: 2, start: '2026-01-01' })
    expect(s.routines.map(r => r.id)).toEqual(['mine', ...second.routines.map(r => r.id)])
    expect(s.week[3]).toBeUndefined()
    expect(s.week[4]).toEqual([second.routines[1].id])
    expect(s.program.phase).toBe(2)
    expect(s.program.start).toBe('2026-01-01')
  })
})
