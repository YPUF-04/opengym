// The daily tracker behind views/Daily.jsx: a routine checklist you tick off each day, and the
// day's numbers (steps, water, sleep, food with calories and protein) against goals worked out
// from your body.
//
//   S.habits    = [{ id, name, days: [0..6] (Date#getDay, empty = every day), slot }]
//   S.daily     = { '2026-10-31': { done: { [habitId]: true }, steps, water, sleep, food: [...] , _ts } }
//   S.bodyInfo  = { height (cm), age, sex: 'male'|'female', activity, goal: 'lose'|'keep'|'gain' }
//   S.dailyGoals = { steps, water (ml), sleep (h), kcal, protein (g), proteinPerKg } (null = worked out for you;
//                   proteinPerKg sets protein from your weight, a fixed `protein` wins over it)
//
// S.daily is one of the stamped maps (lib/sync-merge.js STAMPED_MAPS): each day carries its own
// `_ts`, so a day edited on the phone and another on the desktop both survive a sync.
// Everything here is pure, so the screen only renders what these return.

import { isoOf } from './format.js'

export const SLOTS = ['morning', 'afternoon', 'evening', 'any']
export const ACTIVITY = [1.2, 1.375, 1.55, 1.725, 1.9]
export const DEFAULT_GOALS = { steps: 10000, water: 2500, sleep: 8, kcal: null, protein: null }

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)
const num = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null)

const dayOfIso = iso => new Date(iso + 'T12:00:00').getDay()
export const shiftIso = (iso, by) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + by)
  return isoOf(d)
}

/** The day's record, never null. */
export function dayOf(S, iso) {
  const d = isMap(S?.daily) ? S.daily[iso] : null
  return isMap(d) ? d : {}
}

/** The habits due on `iso`: those with no days picked, or with that weekday picked. */
export function habitsForDay(habits, iso) {
  const wd = dayOfIso(iso)
  return (Array.isArray(habits) ? habits : []).filter(h => h && h.id && (!Array.isArray(h.days) || !h.days.length || h.days.includes(wd)))
}

/** { done, total, pct } for the habits due on `iso`. */
export function dayProgress(S, iso) {
  const due = habitsForDay(S?.habits, iso)
  const done = dayOf(S, iso).done || {}
  const n = due.filter(h => done[h.id]).length
  return { done: n, total: due.length, pct: due.length ? Math.round((n / due.length) * 100) : 0 }
}

/**
 * Days in a row with every due habit ticked, counted back from `iso`. Today only adds once it
 * is complete (an unfinished today does not break the run, the day is not over). A day with
 * nothing due is skipped, neither counted nor breaking the run. Looks back at most a year.
 */
export function habitStreak(S, iso) {
  if (!habitsForDay(S?.habits, iso).length && !(S?.habits || []).length) return 0
  let streak = 0
  for (let i = 0; i < 366; i++) {
    const day = shiftIso(iso, -i)
    const p = dayProgress(S, day)
    if (!p.total) continue
    if (p.done === p.total) { streak++; continue }
    if (i === 0) continue
    break
  }
  return streak
}

/** The last `n` days ending on `iso`, oldest first: [{ iso, done, total, pct }]. */
export function history(S, iso, n = 30) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const day = shiftIso(iso, -i)
    out.push({ iso: day, ...dayProgress(S, day) })
  }
  return out
}

/** Average completion over the days that had something due, as a percent (null with none). */
export function completionRate(rows) {
  const due = rows.filter(r => r.total)
  if (!due.length) return null
  return Math.round(due.reduce((s, r) => s + r.done / r.total, 0) / due.length * 100)
}

/** Returns a new S.daily with `iso` changed by `mut(day)` and stamped `now`. */
export function withDay(daily, iso, mut, now = Date.now()) {
  const all = isMap(daily) ? { ...daily } : {}
  const day = isMap(all[iso]) ? JSON.parse(JSON.stringify(all[iso])) : {}
  mut(day)
  day._ts = now
  all[iso] = day
  return all
}

// --- Body ------------------------------------------------------------------------------

export const LB = 0.45359237
export const toKg = (w, unit) => (num(w) == null ? null : unit === 'lb' ? Number(w) * LB : Number(w))

/** Body-mass index from kg and cm, one decimal; null when either is missing. */
export function bmi(kg, cm) {
  kg = num(kg); cm = num(cm)
  if (!kg || !cm) return null
  const m = cm / 100
  return Math.round((kg / (m * m)) * 10) / 10
}

/** The WHO band of a BMI value. */
export function bmiBand(v) {
  if (v == null) return null
  if (v < 18.5) return 'under'
  if (v < 25) return 'normal'
  if (v < 30) return 'over'
  return 'obese'
}

/** Resting energy (Mifflin-St Jeor), kcal a day. */
export function bmr({ kg, cm, age, sex }) {
  kg = num(kg); cm = num(cm); age = num(age)
  if (!kg || !cm || !age) return null
  return Math.round(10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5))
}

/** The day's energy need with activity, and the target for the goal. */
export function energy({ kg, cm, age, sex, activity, goal }) {
  const base = bmr({ kg, cm, age, sex })
  if (base == null) return null
  const tdee = Math.round(base * (ACTIVITY.includes(Number(activity)) ? Number(activity) : 1.375))
  const target = goal === 'lose' ? tdee - 500 : goal === 'gain' ? tdee + 300 : tdee
  return { bmr: base, tdee, target: Math.max(1200, target) }
}

/** Protein a day in grams: 1.6 g/kg to keep, 2.0 while cutting or bulking. */
export function proteinTarget(kg, goal) {
  kg = num(kg)
  if (!kg) return null
  return Math.round(kg * (goal === 'lose' || goal === 'gain' ? 2.0 : 1.6))
}

/** Goals in force: what you set, otherwise worked out from the body (kcal, protein). */
export function goalsOf(S, kg) {
  const set = isMap(S?.dailyGoals) ? S.dailyGoals : {}
  const body = isMap(S?.bodyInfo) ? S.bodyInfo : {}
  const e = energy({ kg, cm: body.height, age: body.age, sex: body.sex, activity: body.activity, goal: body.goal })
  return {
    steps: num(set.steps) ?? DEFAULT_GOALS.steps,
    water: num(set.water) ?? DEFAULT_GOALS.water,
    sleep: num(set.sleep) ?? DEFAULT_GOALS.sleep,
    kcal: num(set.kcal) ?? e?.target ?? null,
    protein: num(set.protein) ?? (num(set.proteinPerKg) && num(kg) ? Math.round(kg * set.proteinPerKg) : null) ?? proteinTarget(kg, body.goal),
  }
}

/** Calories and protein eaten on a day. */
export function foodTotals(food) {
  const list = Array.isArray(food) ? food : []
  return {
    kcal: Math.round(list.reduce((s, f) => s + (num(f?.kcal) || 0), 0)),
    protein: Math.round(list.reduce((s, f) => s + (num(f?.protein) || 0), 0) * 10) / 10,
  }
}

/**
 * Common foods for a quick calorie estimate, per usual portion. Names are English keys,
 * translated where shown. Values are rounded averages, good enough to log a day by.
 */
export const FOODS = [
  { key: 'Egg (1)', kcal: 75, protein: 6.5 },
  { key: 'Chicken breast (150 g)', kcal: 250, protein: 46 },
  { key: 'Beef, lean (150 g)', kcal: 300, protein: 39 },
  { key: 'Tuna, can (120 g)', kcal: 140, protein: 30 },
  { key: 'Salmon (150 g)', kcal: 310, protein: 31 },
  { key: 'Whey protein (1 scoop)', kcal: 120, protein: 24 },
  { key: 'Greek yogurt (200 g)', kcal: 130, protein: 20 },
  { key: 'Yogurt (200 g)', kcal: 120, protein: 7 },
  { key: 'Milk (250 ml)', kcal: 155, protein: 8 },
  { key: 'Cottage cheese (100 g)', kcal: 98, protein: 11 },
  { key: 'White cheese (50 g)', kcal: 130, protein: 8 },
  { key: 'Oats (60 g)', kcal: 225, protein: 8 },
  { key: 'Rice, cooked (200 g)', kcal: 260, protein: 5 },
  { key: 'Bulgur, cooked (200 g)', kcal: 165, protein: 6 },
  { key: 'Pasta, cooked (200 g)', kcal: 310, protein: 11 },
  { key: 'Bread (1 slice)', kcal: 80, protein: 3 },
  { key: 'Lentil soup (1 bowl)', kcal: 180, protein: 10 },
  { key: 'Potato (200 g)', kcal: 155, protein: 4 },
  { key: 'Banana (1)', kcal: 105, protein: 1.3 },
  { key: 'Apple (1)', kcal: 95, protein: 0.5 },
  { key: 'Nuts (30 g)', kcal: 180, protein: 6 },
  { key: 'Peanut butter (1 tbsp)', kcal: 95, protein: 4 },
  { key: 'Olive oil (1 tbsp)', kcal: 120, protein: 0 },
  { key: 'Salad (1 bowl)', kcal: 60, protein: 2 },
]

// --- Suggestions -----------------------------------------------------------------------

// Well-known catalogue exercises per muscle group, the pool suggestions are drawn from.
export const SUGGEST_POOL = {
  chest: ['0025', '0289', '0662', '0576', '0308'],
  back: ['0652', '0027', '1236', '0861', '0499', '1503'],
  legs: ['0043', '1760', '0032', '1459', '0336', '1460', '1060', '0585', '0599', '0514', '0549'],
  shoulders: ['0405', '0334', '0406'],
  arms: ['0031', '0294', '0313', '0814', '2249', '0283'],
  core: ['0472', '0630', '1160', '0267'],
}
export const GROUP_OF = Object.fromEntries(Object.entries(SUGGEST_POOL).flatMap(([g, ids]) => ids.map(id => [id, g])))

const BP_GROUP = { chest: 'chest', back: 'back', 'upper legs': 'legs', 'lower legs': 'legs', shoulders: 'shoulders', 'upper arms': 'arms', 'lower arms': 'arms', waist: 'core', neck: 'shoulders' }

/** Days since each muscle group was last trained (null = not in the last `look` days). */
export function groupRest(workouts, iso, exIndex, look = 14) {
  const from = shiftIso(iso, -look)
  const last = {}
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w?.d || w.d < from || w.d > iso) continue
    for (const e of Array.isArray(w.entries) ? w.entries : []) {
      const g = GROUP_OF[e?.id] || BP_GROUP[exIndex?.[e?.id]?.bp]
      if (g && (!last[g] || w.d > last[g])) last[g] = w.d
    }
  }
  const out = {}
  for (const g of Object.keys(SUGGEST_POOL)) {
    out[g] = last[g] ? Math.round((new Date(iso + 'T12:00:00') - new Date(last[g] + 'T12:00:00')) / 864e5) : null
  }
  return out
}

/**
 * Up to `n` exercises for today: the most rested groups first (not trained for 2+ days),
 * `perGroup` from each, keeping only what `available(id)` says your equipment allows.
 * The pick inside a group turns with the day, so it is not the same list every time.
 */
export function suggest({ workouts, iso, available = () => true, exIndex, n = 6, perGroup = 2 }) {
  const rest = groupRest(workouts, iso, exIndex)
  const groups = Object.keys(SUGGEST_POOL)
    .filter(g => rest[g] == null || rest[g] >= 2)
    .sort((a, b) => (rest[b] ?? 99) - (rest[a] ?? 99) || Object.keys(SUGGEST_POOL).indexOf(a) - Object.keys(SUGGEST_POOL).indexOf(b))
  const seed = Math.floor(new Date(iso + 'T12:00:00').getTime() / 864e5)
  const out = []
  for (const g of groups) {
    const ids = SUGGEST_POOL[g].filter(available)
    for (let i = 0; i < Math.min(perGroup, ids.length); i++) out.push({ id: ids[(seed + i) % ids.length], group: g, rest: rest[g] })
    if (out.length >= n) break
  }
  return out.slice(0, n)
}
