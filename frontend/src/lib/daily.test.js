import { describe, it, expect } from 'vitest'
import { habitsForDay, dayProgress, habitStreak, history, completionRate, withDay, bmi, bmiBand, bmr, energy, proteinTarget, goalsOf, foodTotals, toKg, groupRest, suggest, shiftIso } from './daily.js'

// 2026-10-31 is a Saturday (getDay 6)
const SAT = '2026-10-31'
const habits = [
  { id: 'a', name: 'Water', days: [] },
  { id: 'b', name: 'Work', days: [1, 2, 3, 4, 5] },
]

describe('habits', () => {
  it('filters by weekday, empty days meaning every day', () => {
    expect(habitsForDay(habits, SAT).map(h => h.id)).toEqual(['a'])
    expect(habitsForDay(habits, '2026-10-30').map(h => h.id)).toEqual(['a', 'b'])
  })
  it('counts progress of the due habits only', () => {
    const S = { habits, daily: { [SAT]: { done: { a: true, b: true } } } }
    expect(dayProgress(S, SAT)).toEqual({ done: 1, total: 1, pct: 100 })
  })
  it('streak: an unfinished today does not break it, a missed day does', () => {
    const daily = {
      '2026-10-28': { done: { a: true } },
      '2026-10-29': { done: { a: true, b: true } },
      '2026-10-30': { done: { a: true, b: true } },
    }
    expect(habitStreak({ habits, daily }, SAT)).toBe(2)
    daily[SAT] = { done: { a: true } }
    expect(habitStreak({ habits, daily }, SAT)).toBe(3)
  })
  it('streak skips days with nothing due', () => {
    const h = [{ id: 'w', name: 'Work', days: [5] }] // Fridays only
    const daily = { '2026-10-30': { done: { w: true } }, '2026-10-23': { done: { w: true } } }
    expect(habitStreak({ habits: h, daily }, SAT)).toBe(2)
  })
  it('history and completion rate', () => {
    const S = { habits, daily: { [SAT]: { done: { a: true } } } }
    const rows = history(S, SAT, 2)
    expect(rows.map(r => r.iso)).toEqual(['2026-10-30', SAT])
    expect(completionRate(rows)).toBe(50)
    expect(completionRate([])).toBe(null)
  })
  it('withDay copies, changes and stamps a day', () => {
    const before = { [SAT]: { steps: 10 } }
    const after = withDay(before, SAT, d => { d.steps = 20 }, 123)
    expect(after[SAT]).toEqual({ steps: 20, _ts: 123 })
    expect(before[SAT].steps).toBe(10)
  })
  it('shiftIso crosses months', () => {
    expect(shiftIso(SAT, 1)).toBe('2026-11-01')
  })
})

describe('body', () => {
  it('bmi and bands', () => {
    expect(bmi(78.4, 180)).toBe(24.2)
    expect(bmiBand(24.2)).toBe('normal')
    expect(bmiBand(31)).toBe('obese')
    expect(bmi(null, 180)).toBe(null)
  })
  it('bmr, energy and protein', () => {
    expect(bmr({ kg: 80, cm: 180, age: 25, sex: 'male' })).toBe(1805)
    expect(bmr({ kg: 60, cm: 165, age: 30, sex: 'female' })).toBe(1320)
    const e = energy({ kg: 80, cm: 180, age: 25, sex: 'male', activity: 1.55, goal: 'lose' })
    expect(e).toEqual({ bmr: 1805, tdee: 2798, target: 2298 })
    expect(proteinTarget(80, 'keep')).toBe(128)
    expect(proteinTarget(80, 'gain')).toBe(160)
  })
  it('converts lb to kg', () => {
    expect(toKg(176.37, 'lb')).toBeCloseTo(80, 1)
    expect(toKg(80, 'kg')).toBe(80)
  })
  it('goals: set values win, otherwise worked out', () => {
    const S = { bodyInfo: { height: 180, age: 25, sex: 'male', activity: 1.55, goal: 'keep' }, dailyGoals: { steps: 8000 } }
    expect(goalsOf(S, 80)).toEqual({ steps: 8000, water: 2500, sleep: 8, kcal: 2798, protein: 128 })
    expect(goalsOf({}, null).kcal).toBe(null)
  })
  it('food totals', () => {
    expect(foodTotals([{ kcal: 75, protein: 6.5 }, { kcal: 120, protein: 24 }])).toEqual({ kcal: 195, protein: 30.5 })
    expect(foodTotals(null)).toEqual({ kcal: 0, protein: 0 })
  })
})

describe('suggestions', () => {
  const workouts = [{ d: '2026-10-30', entries: [{ id: '0025' }] }, { d: '2026-10-27', entries: [{ id: '0043' }] }]
  it('days since each group was trained', () => {
    const r = groupRest(workouts, SAT)
    expect(r.chest).toBe(1)
    expect(r.legs).toBe(4)
    expect(r.back).toBe(null)
  })
  it('skips groups trained yesterday and respects equipment', () => {
    const out = suggest({ workouts, iso: SAT, available: id => id !== '0652', n: 20 })
    expect(out.some(s => s.group === 'chest')).toBe(false)
    expect(out.some(s => s.id === '0652')).toBe(false)
    expect(out[0].group).not.toBe('legs') // never-trained groups come before the 4-day-rested legs
    expect(out.length).toBeGreaterThan(0)
  })
})
