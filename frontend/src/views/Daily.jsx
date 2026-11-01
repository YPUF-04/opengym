import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO, fmtNum, uid, DAYS, weekOrder, weekStartOf, exerciseNameText } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { lastBW } from '../lib/history.js'
import {
  SLOTS, FOODS, dayOf, habitsForDay, dayProgress, habitStreak, history, completionRate,
  withDay, shiftIso, bmi, bmiBand, energy, goalsOf, foodTotals, toKg, suggest,
} from '../lib/daily.js'
import { EXIDX } from '../lib/exercises.js'
import { exAvailable } from '../lib/equipment.js'
import Icon from '../components/Icon.jsx'
import { Button, Check, NumberField, Row, Section, Segmented, TextField } from '../components/ui.jsx'
import { exerciseDetailSheet, goalSheet, bwSheet, confirmSheet } from '../sheets.jsx'
import { waterSheet, stepsSheet, sleepSheet, proteinSheet, kcalSheet, profileSheet, gearSheet, gearSummary, planSheet } from '../components/DailySheets.jsx'

const update = (...a) => useStore.getState().update(...a)
const getS = () => useStore.getState().S
const openSheet = fn => useUI.getState().openSheet(fn)
const toast = m => useUI.getState().toast(m)

const editDay = (iso, mut) => update(s => { s.daily = withDay(s.daily, iso, mut) })

const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', any: 'Any time' }
const SLOT_ICON = { morning: 'sunrise', afternoon: 'sun', evening: 'moon', any: 'list' }
const GROUP_LABEL = { chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms', core: 'Core' }
const BAND_LABEL = { under: 'Underweight', normal: 'Healthy weight', over: 'Overweight', obese: 'Obese' }

// A progress ring: `value` of `goal`, the number in the middle.
function Ring({ value, goal, color, label, text, size = 64 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r
  const p = goal ? Math.max(0, Math.min(1, value / goal)) : 0
  return <div className="dly-ring">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .4s' }} />
    </svg>
    <div className="dly-ring-v">{text}</div>
    <div className="dly-ring-l">{label}</div>
  </div>
}

function Bar({ value, goal, color }) {
  const p = goal ? Math.max(0, Math.min(1, value / goal)) : 0
  return <div className="dly-bar"><span style={{ width: (p * 100) + '%', background: color }} /></div>
}

/* ---------------------------------- sheets ---------------------------------- */

function HabitSheet({ habit, close }) {
  const S = getS()
  const [name, setName] = useState(habit?.name || '')
  const [days, setDays] = useState(habit?.days || [])
  const [slot, setSlot] = useState(habit?.slot || 'any')
  const order = weekOrder(weekStartOf(S))
  const toggle = d => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort())
  const save = () => {
    const n = name.trim()
    if (!n) { toast(t('Give it a name')); return }
    update(s => {
      const list = Array.isArray(s.habits) ? [...s.habits] : []
      if (habit) { const i = list.findIndex(h => h.id === habit.id); if (i >= 0) list[i] = { ...list[i], name: n, days, slot } }
      else list.push({ id: uid(), name: n, days, slot })
      s.habits = list
    })
    close()
  }
  return <>
    <h3>{habit ? t('Edit task') : t('New task')}</h3>
    <TextField autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('e.g. Drink 3 L of water, Go to work, Take vitamins')} maxLength={80} />
    <div className="muted small" style={{ margin: '14px 0 6px' }}>{t('Which days? (none picked = every day)')}</div>
    <div className="dly-days">
      {order.map(d => <button key={d} className={'dly-day' + (days.includes(d) ? ' on' : '')} onClick={() => toggle(d)}>{t(DAYS[d])}</button>)}
    </div>
    <div className="muted small" style={{ margin: '14px 0 6px' }}>{t('Time of day')}</div>
    <Segmented value={slot} onChange={setSlot} options={SLOTS.map(v => ({ value: v, label: t(SLOT_LABEL[v]) }))} />
    <div style={{ height: 16 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
    {habit && <><div style={{ height: 8 }} /><Button variant="danger" onClick={() => {
      close()
      confirmSheet({ title: t('Delete this task?'), message: t('Days you already ticked keep their record.'), confirmText: t('Delete'), danger: true,
        onConfirm: () => update(s => { s.habits = (s.habits || []).filter(h => h.id !== habit.id) }) })
    }}>{t('Delete task')}</Button></>}
  </>
}
const habitSheet = habit => openSheet(close => <HabitSheet habit={habit} close={close} />)

function FoodSheet({ iso, close }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(null)
  const [protein, setProtein] = useState(null)
  const [q, setQ] = useState('')
  const add = f => {
    editDay(iso, d => { d.food = [...(Array.isArray(d.food) ? d.food : []), { id: uid(), ...f }] })
    toast(t('Added: {0}', f.name))
  }
  const list = FOODS.filter(f => !q || t(f.key).toLocaleLowerCase(dateLocale()).includes(q.toLocaleLowerCase(dateLocale())))
  return <>
    <h3>{t('Add food')}</h3>
    <TextField value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search common foods')} />
    <div className="dly-foods">
      {list.map(f => <button key={f.key} className="dly-food" onClick={() => add({ name: t(f.key), kcal: f.kcal, protein: f.protein })}>
        <span>{t(f.key)}</span><span className="muted small">{f.kcal} kcal · {fmtNum(f.protein)} g</span>
      </button>)}
    </div>
    <div className="muted small" style={{ margin: '14px 0 6px' }}>{t('Or enter your own')}</div>
    <TextField value={name} onChange={e => setName(e.target.value)} placeholder={t('Name')} maxLength={60} />
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      <label className="dly-num"><span className="muted small">kcal</span><NumberField value={kcal} onChange={setKcal} nullable decimal={false} /></label>
      <label className="dly-num"><span className="muted small">{t('Protein')} (g)</span><NumberField value={protein} onChange={setProtein} nullable /></label>
    </div>
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={() => {
      if (!name.trim() && !kcal && !protein) { toast(t('Enter a name or calories')); return }
      add({ name: name.trim() || t('Food'), kcal: kcal || 0, protein: protein || 0 }); close()
    }}>{t('Add')}</Button>
    <div style={{ height: 8 }} /><Button onClick={close}>{t('Done')}</Button>
  </>
}
const foodSheet = iso => openSheet(close => <FoodSheet iso={iso} close={close} />)

/* ---------------------------------- screen ---------------------------------- */

export default function Daily() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [iso, setIso] = useState(todayISO())
  const [editing, setEditing] = useState(false)
  const today = todayISO()
  const day = dayOf(S, iso)
  const due = habitsForDay(S.habits, iso)
  const prog = dayProgress(S, iso)
  const streak = habitStreak(S, today)
  const rows = history(S, today, 14)
  const rate = completionRate(history(S, today, 30))
  const bw = lastBW(S)
  const kg = bw ? toKg(bw.w, S.unit) : null
  const goals = goalsOf(S, kg)
  const eaten = foodTotals(day.food)
  const body = S.bodyInfo || {}
  const bmiV = bmi(kg, body.height)
  const band = bmiBand(bmiV)
  const en = energy({ kg, cm: body.height, age: body.age, sex: body.sex, activity: body.activity, goal: body.goal })
  const autoProtein = goalsOf({ bodyInfo: body }, kg).protein
  const sugg = suggest({ workouts: S.workouts, iso: today, available: id => EXIDX[id] && exAvailable(S, EXIDX[id]), exIndex: EXIDX, n: 4 })
  const date = new Date(iso + 'T12:00:00')
  const dateLabel = iso === today ? t('Today') : iso === shiftIso(today, -1) ? t('Yesterday') : date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  const water = Number(day.water) || 0, steps = Number(day.steps) || 0, sleep = Number(day.sleep) || 0
  const allHabits = Array.isArray(S.habits) ? S.habits : []
  const g = S.dailyGoals || {}
  const aboutValue = [body.height ? fmtNum(body.height) + ' cm' : null, body.age ? t('{0} y', body.age) : null].filter(Boolean).join(' · ') || t('Not set')

  return <div className="narrow dly">
    <div className="hdr">
      <button className="iconbtn" data-back="/home" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Daily')}</h1><div className="sub">{t('Routine, food and activity')}</div></div>
      <button className="iconbtn" onClick={profileSheet} aria-label={t('About you')}><Icon name="person" /></button>
    </div>

    {/* Today at a glance */}
    <div className="card dly-hero">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setIso(shiftIso(iso, -1))} aria-label={t('Previous day')}><Icon name="chevronLeft" /></button>
        <div style={{ fontWeight: 600 }}>{dateLabel}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15, visibility: iso >= today ? 'hidden' : 'visible' }} onClick={() => setIso(shiftIso(iso, 1))} aria-label={t('Next day')}><Icon name="chevronRight" /></button>
      </div>
      <div className="dly-rings">
        <Ring value={prog.done} goal={prog.total || 1} color="var(--acc)" label={t('Routine')} text={prog.total ? prog.pct + '%' : '–'} />
        <Ring value={eaten.kcal} goal={goals.kcal || 0} color="var(--orange)" label="kcal" text={fmtNum(eaten.kcal)} />
        <Ring value={eaten.protein} goal={goals.protein || 0} color="var(--pink)" label={t('Protein')} text={fmtNum(Math.round(eaten.protein)) + 'g'} />
        <Ring value={water} goal={goals.water} color="var(--blue)" label={t('Water')} text={fmtNum(Math.round(water / 100) / 10) + 'L'} />
      </div>
    </div>

    {/* Routine checklist, with the streak on top and two weeks of dots underneath */}
    <div className="card">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>{t('Routine')}</h2>
        <div className="row" style={{ gap: 6 }}>
          {!!allHabits.length && <Button size="sm" variant={editing ? 'tinted' : 'ghost'} icon="pencil" onClick={() => setEditing(e => !e)}>{editing ? t('Done') : t('Edit')}</Button>}
          <Button size="sm" icon="plus" onClick={() => habitSheet(null)}>{t('Add')}</Button>
        </div>
      </div>
      {!!allHabits.length && <div className="dly-streak">
        <Icon name="flame" style={{ color: 'var(--orange)' }} /> <b>{t('{0} day streak', streak)}</b>
        {rate != null && <span className="muted"> · {t('{0}% in 30 days', rate)}</span>}
      </div>}
      {!allHabits.length ? <div className="muted small" style={{ marginTop: 6 }}>{t('Add the things you want to do every day: work, water, vitamins, reading, a walk. Tick them off here and keep your streak going.')}</div>
        : editing ? allHabits.map(h => <div key={h.id} className="dly-task tap" onClick={() => habitSheet(h)}>
          <Icon name={SLOT_ICON[h.slot] || 'list'} className="muted" />
          <span className="dly-task-n">{h.name}<span className="muted small dly-task-d">{h.days?.length ? h.days.map(d => t(DAYS[d])).join(' ') : t('Every day')}</span></span>
          <Icon name="chevronRight" className="chev" />
        </div>)
        : !due.length ? <div className="muted small" style={{ marginTop: 6 }}>{t('Nothing planned for this day.')}</div>
        : SLOTS.map(slot => {
          const items = due.filter(h => (h.slot || 'any') === slot)
          if (!items.length) return null
          return <div key={slot} className="dly-slot">
            <div className="dly-slot-t"><Icon name={SLOT_ICON[slot]} /> {t(SLOT_LABEL[slot])}</div>
            {items.map(h => {
              const on = !!day.done?.[h.id]
              const toggle = () => editDay(iso, d => { d.done = { ...(d.done || {}) }; if (on) delete d.done[h.id]; else d.done[h.id] = true })
              return <div key={h.id} className={'dly-task' + (on ? ' on' : '')} onClick={toggle}>
                <Check checked={on} onChange={toggle} label={h.name} />
                <span className="dly-task-n">{h.name}</span>
              </div>
            })}
          </div>
        })}
      {prog.total > 0 && prog.done === prog.total && <div className="dly-done"><Icon name="checkCircle" /> {t('All done for the day. Well done!')}</div>}
      {!!allHabits.length && <div className="dly-dots" aria-label={t('Last 2 weeks')}>
        {rows.map(r => <button key={r.iso} title={r.iso} onClick={() => setIso(r.iso)} aria-label={r.iso}
          className={'dly-dot' + (r.iso === iso ? ' sel' : '') + (!r.total ? ' none' : r.pct === 100 ? ' full' : r.pct ? ' part' : '')} />)}
      </div>}
    </div>

    {/* Food */}
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t('Food')}</h2>
        <Button size="sm" icon="plus" onClick={() => foodSheet(iso)}>{t('Add')}</Button>
      </div>
      <div className="dly-stat"><span>{t('Calories')}</span><span><b>{fmtNum(eaten.kcal)}</b>{goals.kcal ? ' / ' + fmtNum(goals.kcal) : ''} kcal</span></div>
      <Bar value={eaten.kcal} goal={goals.kcal} color="var(--orange)" />
      <div className="dly-stat"><span>{t('Protein')}</span><span><b>{fmtNum(eaten.protein)}</b>{goals.protein ? ' / ' + fmtNum(goals.protein) : ''} g</span></div>
      <Bar value={eaten.protein} goal={goals.protein} color="var(--pink)" />
      {goals.kcal ? <div className="muted small">{eaten.kcal <= goals.kcal ? t('{0} kcal left today', fmtNum(goals.kcal - eaten.kcal)) : t('{0} kcal over today', fmtNum(eaten.kcal - goals.kcal))}</div>
        : <div className="muted small">{t('Enter your height and age to get a calorie target.')}</div>}
      {(day.food || []).map(f => <div key={f.id} className="dly-fooditem">
        <span>{f.name}</span>
        <span className="muted small">{fmtNum(f.kcal || 0)} kcal · {fmtNum(f.protein || 0)} g</span>
        <button className="iconbtn" style={{ width: 28, height: 28, fontSize: 13 }} aria-label={t('Delete')} onClick={() => editDay(iso, d => { d.food = (d.food || []).filter(x => x.id !== f.id) })}><Icon name="xmark" /></button>
      </div>)}
    </div>

    {/* Activity */}
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('Activity')}</h2>
      <div className="dly-act">
        <Icon name="cloud" style={{ color: 'var(--blue)' }} />
        <span className="dly-act-l">{t('Water')}</span>
        <span><b>{fmtNum(water / 1000)}</b> / {fmtNum(goals.water / 1000)} L</span>
        <button className="iconbtn" aria-label={t('Less water')} onClick={() => editDay(iso, d => { d.water = Math.max(0, (Number(d.water) || 0) - 250) })}><Icon name="minus" /></button>
        <button className="iconbtn" aria-label={t('One glass of water')} onClick={() => editDay(iso, d => { d.water = (Number(d.water) || 0) + 250 })}><Icon name="plus" /></button>
      </div>
      <Bar value={water} goal={goals.water} color="var(--blue)" />
      <div className="dly-act">
        <Icon name="steps" style={{ color: 'var(--teal)' }} />
        <span className="dly-act-l">{t('Steps')}</span>
        <NumberField value={day.steps ?? null} nullable decimal={false} placeholder="0" onChange={v => editDay(iso, d => { d.steps = v || 0 })} />
        <button className="iconbtn" aria-label="+1000" onClick={() => editDay(iso, d => { d.steps = (Number(d.steps) || 0) + 1000 })}><span className="small">+1k</span></button>
      </div>
      <Bar value={steps} goal={goals.steps} color="var(--teal)" />
      <div className="dly-act">
        <Icon name="moon" style={{ color: 'var(--indigo)' }} />
        <span className="dly-act-l">{t('Sleep')}</span>
        <span><b>{fmtNum(sleep)}</b> / {fmtNum(goals.sleep)} {t('h')}</span>
        <button className="iconbtn" aria-label={t('Less sleep')} onClick={() => editDay(iso, d => { d.sleep = Math.max(0, (Number(d.sleep) || 0) - 0.5) })}><Icon name="minus" /></button>
        <button className="iconbtn" aria-label={t('More sleep')} onClick={() => editDay(iso, d => { d.sleep = Math.min(16, (Number(d.sleep) || 0) + 0.5) })}><Icon name="plus" /></button>
      </div>
      <Bar value={sleep} goal={goals.sleep} color="var(--indigo)" />
    </div>

    {/* Every goal and setting in one list; each row opens a picker that saves on the spot */}
    <Section title={t('My goals')} className="dly-goals">
      <Row icon="scale" iconTint="var(--teal)" title={t('Weight')} value={bw ? fmtNum(bw.w) + ' ' + S.unit : t('Log')} accessory="chevron" onClick={() => bwSheet()} />
      <Row icon="target" iconTint="var(--yellow)" title={t('Target weight')} value={S.targetW ? fmtNum(S.targetW) + ' ' + S.unit : t('Not set')} accessory="chevron" onClick={goalSheet} />
      <Row icon="person" iconTint="var(--indigo)" title={t('About you')} subtitle={band ? 'BMI ' + fmtNum(bmiV) + ' · ' + t(BAND_LABEL[band]) : null} value={aboutValue} accessory="chevron" onClick={profileSheet} />
      <Row icon="flame" iconTint="var(--orange)" title={t('Calories')} value={goals.kcal ? fmtNum(goals.kcal) + ' kcal' + (g.kcal == null ? ' · ' + t('auto') : '') : t('Not set')} accessory="chevron" onClick={() => kcalSheet(en)} />
      <Row icon="bolt" iconTint="var(--pink)" title={t('Protein')} value={goals.protein ? fmtNum(goals.protein) + ' g' + (g.protein == null && g.proteinPerKg == null ? ' · ' + t('auto') : '') : t('Not set')} accessory="chevron" onClick={() => proteinSheet(kg, autoProtein)} />
      <Row icon="cloud" iconTint="var(--blue)" title={t('Water')} value={fmtNum(goals.water / 1000) + ' L'} accessory="chevron" onClick={waterSheet} />
      <Row icon="steps" iconTint="var(--teal)" title={t('Steps')} value={fmtNum(goals.steps)} accessory="chevron" onClick={stepsSheet} />
      <Row icon="moon" iconTint="var(--indigo)" title={t('Sleep')} value={fmtNum(goals.sleep) + ' ' + t('h')} accessory="chevron" onClick={sleepSheet} />
    </Section>

    <Section title={t('Training')} className="dly-goals">
      <Row icon="kettlebell" iconTint="var(--acc)" title={t('My equipment')} value={gearSummary(S)} accessory="chevron" onClick={gearSheet} />
      <Row icon="clipboard" iconTint="var(--green)" title={t('A plan for your equipment')} accessory="chevron" onClick={planSheet} />
    </Section>

    {/* Suggestions */}
    {!!sugg.length && <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: 2 }}>{t('Suggested for today')}</h2>
      <div className="muted small" style={{ marginBottom: 4 }}>{t('Muscles you have not trained for a while, with the equipment you have.')}</div>
      {sugg.map(s => <div key={s.id} className="dly-task tap" onClick={() => exerciseDetailSheet(EXIDX[s.id])}>
        <span className="tag" style={{ minWidth: 64, textAlign: 'center' }}>{t(GROUP_LABEL[s.group])}</span>
        <span className="dly-task-n">{exerciseNameText(EXIDX[s.id])}<span className="muted small dly-task-d">{s.rest == null ? t('not trained lately') : t('{0} days rest', s.rest)}</span></span>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </div>}
  </div>
}
