// Gearly's Home: only what you need each day, in plain words. The coach on top (set up a program,
// or its check-ins), today's workout, today's weigh-in and goal, then water, calories, steps and
// the weekly streak as tiles, each a tap away from its detail. The classic Home (views/Home.jsx)
// is still there: Settings → Look & Home → Classic home.
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { effectiveRoutines, effectiveRoutineIds, lastBW, streakWeeks } from '../lib/history.js'
import { weekTally } from '../lib/queue.js'
import { dayOf, dayProgress, foodTotals, goalsOf, toKg, withDay, shiftIso } from '../lib/daily.js'
import { reviewDue, nextCheck, buildProgram, applyProgram } from '../lib/program.js'
import { glyphOf } from '../lib/glyphs.js'
import { startFlow, bwSheet, goalSheet } from '../sheets.jsx'
import { foodSheet } from '../views/Daily.jsx'
import Icon from './Icon.jsx'
import { Button, NumberField } from './ui.jsx'
import GetTheApp from './GetTheApp.jsx'
import { MOBILE } from '../lib/mobile.js'
import { tappable } from '../lib/use-sheet-keyboard.js'

const update = (...a) => useStore.getState().update(...a)
const toast = m => useUI.getState().toast(m)
const editDay = (iso, mut) => update(s => { s.daily = withDay(s.daily, iso, mut) })

function StepsSheet({ close }) {
  const steps = useStore(s => dayOf(s.S, todayISO()).steps ?? null)
  return <>
    <h3>{t('Steps today')}</h3>
    <div className="dly-field"><span>{t('Steps')}</span>
      <NumberField value={steps} nullable decimal={false} placeholder="0" onChange={v => editDay(todayISO(), d => { d.steps = v || 0 })} /><i /></div>
    <div className="ch-quick">{[1000, 2000, 5000].map(n => <button key={n} className="ch-q" onClick={() => editDay(todayISO(), d => { d.steps = (Number(d.steps) || 0) + n })}>+{fmtNum(n)}</button>)}</div>
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}

// The coach's line: set it up, a check-in question, or where the program stands.
function CoachCard({ S, nav }) {
  const p = S.program
  const today = todayISO()
  if (!p) return <div className="card sh-coach" {...tappable(() => nav('/program'))}>
    <div className="sh-coach-ic"><Icon name="sparkles" /></div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="sh-coach-t">{t('Let the coach build your program')}</div>
      <div className="muted small">{t('A few questions, 2 minutes. It uses only the equipment you have.')}</div>
    </div>
    <Icon name="chevronRight" className="chev" />
  </div>
  const due = reviewDue(p, today)
  const rebuild = (answers, phase, extraOpts = {}) => {
    const built = buildProgram(answers, phase, undefined, t)
    update(s => { applyProgram(s, answers, built, today, { phase, start: p.start, ...extraOpts }) })
    toast(t('Your program is ready'))
  }
  const snooze = () => update(s => { s.program = { ...s.program, snoozeUntil: shiftIso(today, 14) } })
  if (due) return <div className="card sh-coach ask">
    <div className="sh-coach-ic"><Icon name="sparkles" /></div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="sh-coach-t">{due.kind === 'refresh' ? t('Ten weeks done. Shall we refresh your program?') : t('Six months in. Ready for the next stage?')}</div>
      <div className="muted small">{due.kind === 'refresh' ? t('A new program with one more exercise and a bit more work, so you keep making progress.') : t('Go from {0} to {1} days a week, with each muscle group on its own day.', due.from, due.days)}</div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <Button size="sm" variant="primary" onClick={() => due.kind === 'refresh'
          ? rebuild(p.answers, (p.phase || 1) + 1)
          : rebuild({ ...p.answers, days: due.days }, (p.phase || 1) + 1, { leveledUp: true })}>{t('Yes, do it')}</Button>
        <Button size="sm" variant="ghost" onClick={snooze}>{t('Later')}</Button>
      </div>
    </div>
  </div>
  const nc = nextCheck(p)
  return <div className="card sh-coach ask">
    <div className="sh-coach-ic"><Icon name="sparkles" /></div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="sh-coach-t">{t('Coach: {0} days a week, stage {1}', p.answers?.days || 3, p.phase || 1)}</div>
      <div className="muted small">{nc ? t('Next check-in on {0}', new Date(nc + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' })) : ''}</div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <Button size="sm" variant="tinted" icon="plus" onClick={e => { e.stopPropagation(); rebuild({ ...p.answers, extra: (p.answers?.extra || 0) + 1 }, p.phase || 1) }}>{t('More exercises')}</Button>
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); nav('/program') }}>{t('Change')}</Button>
      </div>
    </div>
  </div>
}

export default function SimpleHome() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const today = todayISO()
  const day = dayOf(S, today)
  const bw = lastBW(S)
  const weighedToday = bw?.d === today
  const kg = bw ? toKg(bw.w, S.unit) : null
  const goals = goalsOf(S, kg)
  const eaten = foodTotals(day.food)
  const water = Number(day.water) || 0
  const steps = Number(day.steps) || 0
  const routines = effectiveRoutines(S, today)
  const doneToday = S.workouts.some(w => w.d === today)
  const tasks = dayProgress(S, today)
  const { done: wkDone, planned: wkPlanned } = weekTally(S, today)
  const streak = streakWeeks(S)
  const toGo = S.targetW && bw ? Math.abs(S.targetW - bw.w) : null
  const startToday = () => { if (S.active) nav('/workout'); else if (routines.length) startFlow(effectiveRoutineIds(S, today)); else nav('/workout') }

  return <div className="narrow sh">
    <div className="hdr">
      <div><h1>{user ? t('Hi {0}', user.name) : t('Hello')}</h1><div className="sub">{new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    <CoachCard S={S} nav={nav} />

    {/* Today's workout. Tapping the card opens the whole plan; the button starts it. */}
    <div className="card sh-today" {...tappable(() => nav('/plan'))}>
      <div className="lbl2">{t('Today')}</div>
      {S.active ? <div className="sh-today-row">
        <div className="sh-today-n">{S.active.name}</div>
        <Button size="sm" variant="primary" icon="play" onClick={e => { e.stopPropagation(); nav('/workout') }}>{t('Resume')}</Button>
      </div> : doneToday ? <div className="sh-today-row">
        <div className="sh-today-n"><Icon name="checkCircle" style={{ color: 'var(--green)' }} /> {t('Workout done. Well done!')}</div>
      </div> : routines.length ? <div className="sh-today-row">
        <div style={{ minWidth: 0 }}>
          <div className="sh-today-n"><Icon name={glyphOf(routines[0].emoji)} /> {routines.map(r => r.name).join(' + ')}</div>
          <div className="muted small">{t('{0} exercises · not done yet', routines.reduce((n, r) => n + r.ex.length, 0))}</div>
        </div>
        <Button size="sm" variant="primary" icon="play" className="sh-go" onClick={e => { e.stopPropagation(); startToday() }}>{t('Start')}</Button>
      </div> : <div className="sh-today-row">
        <div className="sh-today-n"><Icon name="moon" /> {t('Rest day')}</div>
        <span className="muted small">{t('All workouts')} ›</span>
      </div>}
    </div>

    {/* Weigh-in: asked once a day, then the goal */}
    {!weighedToday ? <div className="card sh-weigh" {...tappable(() => bwSheet())}>
      <Icon name="scale" />
      <div style={{ flex: 1 }}><b>{t('How much do you weigh today?')}</b><div className="muted small">{bw ? t('Last time: {0}', fmtNum(bw.w) + ' ' + S.unit) : t('Step on the scale and tap here')}</div></div>
      <Button size="sm" variant="tinted">{t('Enter')}</Button>
    </div> : <div className="card sh-weigh" {...tappable(goalSheet)}>
      <Icon name="target" style={{ color: 'var(--yellow)' }} />
      <div style={{ flex: 1 }}>
        <b>{fmtNum(bw.w)} {S.unit}</b>
        <div className="muted small">{S.targetW ? (toGo < 0.05 ? t('Goal reached!') : t('Goal {0} · {1} to go', fmtNum(S.targetW) + ' ' + S.unit, fmtNum(toGo) + ' ' + S.unit)) : t('Tap to set a goal weight')}</div>
      </div>
    </div>}

    <div className="sh-tiles">
      <div className="sh-tile">
        <div className="sh-tile-h" {...tappable(() => nav('/daily'))}><Icon name="cloud" style={{ color: 'var(--blue)' }} />{t('Water')}</div>
        <div className="sh-tile-v" {...tappable(() => nav('/daily'))}>{fmtNum(water / 1000)}<small> / {fmtNum(goals.water / 1000)} L</small></div>
        <div className="dly-bar"><span style={{ width: Math.min(100, water / goals.water * 100) + '%', background: 'var(--blue)' }} /></div>
        <button className="sh-plus" onClick={() => { editDay(today, d => { d.water = (Number(d.water) || 0) + 250 }) }}><Icon name="plus" /> {t('Glass')}</button>
      </div>
      <div className="sh-tile">
        <div className="sh-tile-h" {...tappable(() => nav('/daily'))}><Icon name="flame" style={{ color: 'var(--orange)' }} />{t('Calories')}</div>
        <div className="sh-tile-v" {...tappable(() => nav('/daily'))}>{fmtNum(eaten.kcal)}<small>{goals.kcal ? ' / ' + fmtNum(goals.kcal) : ''}</small></div>
        <div className="dly-bar"><span style={{ width: (goals.kcal ? Math.min(100, eaten.kcal / goals.kcal * 100) : 0) + '%', background: 'var(--orange)' }} /></div>
        <button className="sh-plus" onClick={() => foodSheet(today)}><Icon name="plus" /> {t('Food')}</button>
      </div>
      <div className="sh-tile" {...tappable(() => useUI.getState().openSheet(close => <StepsSheet close={close} />))}>
        <div className="sh-tile-h"><Icon name="steps" style={{ color: 'var(--teal)' }} />{t('Steps')}</div>
        <div className="sh-tile-v">{fmtNum(steps)}<small> / {fmtNum(goals.steps)}</small></div>
        <div className="dly-bar"><span style={{ width: Math.min(100, steps / goals.steps * 100) + '%', background: 'var(--teal)' }} /></div>
        <div className="muted small">{t('Tap to enter')}</div>
      </div>
      <div className="sh-tile" {...tappable(() => nav('/stats'))}>
        <div className="sh-tile-h"><Icon name="flame" style={{ color: 'var(--orange)' }} />{t('Streak')}</div>
        <div className="sh-tile-v">{streak}<small> {t('weeks')}</small></div>
        <div className="dly-bar"><span style={{ width: (wkPlanned ? Math.min(100, wkDone / wkPlanned * 100) : 0) + '%', background: 'var(--acc)' }} /></div>
        <div className="muted small">{t('{0} of {1} this week', wkDone, wkPlanned || '–')}</div>
      </div>
    </div>

    <div className="card sh-row" {...tappable(() => nav('/daily'))}>
      <span className="lrow-i" style={{ background: 'var(--teal)' }}><Icon name="checkCircle" /></span>
      <div style={{ flex: 1 }}><b>{t('Daily tasks')}</b><div className="muted small">{tasks.total ? t('{0} of {1} done', tasks.done, tasks.total) : t('Water, vitamins, work: add your own')}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>
    <div className="card sh-row" {...tappable(() => nav('/challenges'))}>
      <span className="lrow-i" style={{ background: 'var(--orange)' }}><Icon name="trophy" /></span>
      <div style={{ flex: 1 }}><b>{t('League and challenges')}</b><div className="muted small">{t('Push-up race with friends')}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>

    {!MOBILE && <GetTheApp />}
  </div>
}
