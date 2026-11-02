// The coach's setup: one question per screen, big buttons, then a finished weekly program
// (lib/program.js) built only from what your equipment allows. Re-run any time to change it.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtNum, DAYN } from '../lib/format.js'
import { lastBW } from '../lib/history.js'
import { buildProgram, applyProgram } from '../lib/program.js'
import { GEAR, myProfile, gearOn, withItem, saveMyEquipment } from '../lib/gear.js'
import { profileEquipment } from '../lib/equipment.js'
import { dumbbellsOf, withDumbbells } from '../lib/dumbbells.js'
import { EXIDX } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField } from '../components/ui.jsx'
import { bwSheet } from '../sheets.jsx'

const toast = m => useUI.getState().toast(m)

function Choice({ options, value, onPick }) {
  return <div className="wz-choices">
    {options.map(o => <button key={String(o.value)} className={'wz-choice' + (value === o.value ? ' on' : '')} onClick={() => onPick(o.value)}>
      {o.icon && <Icon name={o.icon} />}
      <span><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
      {value === o.value && <Icon name="checkCircle" className="wz-ok" />}
    </button>)}
  </div>
}

const BELLS = [1, 2, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 15, 17.5, 20, 22.5, 25]

export default function ProgramWizard() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const prev = S.program?.answers || {}
  const prof = myProfile(S)
  const [a, setA] = useState({
    goal: prev.goal || S.bodyInfo?.goal || null,
    level: prev.level || null,
    days: prev.days || null,
    minutes: prev.minutes || null,
    equipment: prof ? profileEquipment(prof) : prev.equipment || [],
    dumbbells: dumbbellsOf(S).length ? dumbbellsOf(S) : prev.dumbbells || [],
  })
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(null)
  const set = (k, v) => setA(x => ({ ...x, [k]: v }))
  const hasBells = a.equipment.includes('dumbbell')
  const bw = lastBW(S)

  const steps = [
    { key: 'goal', title: t('What is your goal?'), ok: !!a.goal, body: <Choice value={a.goal} onPick={v => { set('goal', v); setStep(s => s + 1) }} options={[
      { value: 'lose', icon: 'flame', label: t('Lose fat'), sub: t('More reps, a bit of cardio') },
      { value: 'keep', icon: 'heart', label: t('Get fit and stay fit'), sub: t('A balanced program') },
      { value: 'gain', icon: 'arm', label: t('Build muscle'), sub: t('Heavier, fewer reps') },
    ]} /> },
    { key: 'level', title: t('How much have you trained before?'), ok: !!a.level, body: <Choice value={a.level} onPick={v => { set('level', v); setStep(s => s + 1) }} options={[
      { value: 'new', icon: 'sunrise', label: t('I am just starting'), sub: t('Or starting again after a long break') },
      { value: 'some', icon: 'figureStrength', label: t('A few months'), sub: t('I know the basic moves') },
      { value: 'exp', icon: 'trophy', label: t('A year or more'), sub: t('I train regularly') },
    ]} /> },
    { key: 'days', title: t('How many days a week can you train?'), ok: !!a.days, body: <Choice value={a.days} onPick={v => { set('days', v); setStep(s => s + 1) }} options={[2, 3, 4, 5, 6].map(d => ({
      value: d, label: t('{0} days', d), sub: d === 3 ? t('Best to start with') : d <= 2 ? t('The minimum that works') : d >= 5 ? t('For when you have the time') : null,
    }))} /> },
    { key: 'minutes', title: t('How long is one workout?'), ok: !!a.minutes, body: <Choice value={a.minutes} onPick={v => { set('minutes', v); setStep(s => s + 1) }} options={[
      { value: 30, icon: 'timer', label: t('About 30 minutes'), sub: t('4 exercises') },
      { value: 45, icon: 'timer', label: t('About 45 minutes'), sub: t('5 exercises') },
      { value: 60, icon: 'timer', label: t('An hour'), sub: t('6 exercises') },
    ]} /> },
    { key: 'gear', title: t('What do you have?'), ok: true, sub: t('Tap everything you can use. Nothing ticked means body-weight exercises only.'), body: <div>
      {GEAR.slice(0, 3).map(g => <div key={g.group}>
        <div className="dly-slot-t">{t(g.group)}</div>
        <div className="gear-grid">{g.items.map(i => {
          const on = gearOn({ equipment: a.equipment, accV: 2 }, i)
          return <button key={i.key} className={'gear-tile' + (on ? ' on' : '')} aria-pressed={on} onClick={() => set('equipment', withItem(a.equipment, i, !on))}>
            <Icon name={i.icon} /><span>{t(i.label)}</span>{on && <Icon name="check" className="gear-ok" />}
          </button>
        })}</div>
      </div>)}
    </div> },
    ...(hasBells ? [{ key: 'bells', title: t('How heavy are your dumbbells?'), ok: a.dumbbells.length > 0, sub: t('Tap every weight you have. The program starts with these.'), body: <div className="wz-bells">
      {BELLS.map(w => { const on = a.dumbbells.includes(w); return <button key={w} className={'wz-bell' + (on ? ' on' : '')} onClick={() => set('dumbbells', on ? a.dumbbells.filter(x => x !== w) : [...a.dumbbells, w].sort((x, y) => x - y))}>{fmtNum(w)} kg</button> })}
    </div> }] : []),
    { key: 'body', title: t('Last thing: your weight'), ok: true, sub: t('For your calorie goal and to follow your progress. You can skip it.'), body: <div>
      <button className="wz-choice" onClick={() => bwSheet()}><Icon name="scale" /><span><b>{bw ? fmtNum(bw.w) + ' ' + S.unit : t('Enter my weight')}</b><small>{bw ? t('Tap to change') : t('Takes 5 seconds')}</small></span></button>
      <div className="dly-field" style={{ marginTop: 10 }}><span>{t('Height')}</span><NumberField value={S.bodyInfo?.height ?? null} nullable decimal={false} placeholder="175" onChange={v => useStore.getState().update(s => { s.bodyInfo = { ...(s.bodyInfo || {}), height: v || null } })} /><i>cm</i></div>
      <div className="dly-field"><span>{t('Age')}</span><NumberField value={S.bodyInfo?.age ?? null} nullable decimal={false} placeholder="25" onChange={v => useStore.getState().update(s => { s.bodyInfo = { ...(s.bodyInfo || {}), age: v || null } })} /><i>{t('years')}</i></div>
    </div> },
  ]
  const cur = steps[Math.min(step, steps.length - 1)]
  const last = step >= steps.length - 1

  const finish = () => {
    const answers = { ...a, extra: prev.extra || 0 }
    const built = buildProgram(answers, 1, undefined, t)
    useStore.getState().update(s => {
      saveMyEquipment(s, a.equipment, t('My equipment'))
      if (hasBells) s.dumbbells = withDumbbells(s, a.dumbbells)
      s.bodyInfo = { ...(s.bodyInfo || {}), goal: a.goal }
      applyProgram(s, answers, built, todayISO())
    })
    setDone(built)
    toast(t('Your program is ready'))
  }

  if (done) return <div className="narrow">
    <div className="wz-done">
      <div className="wz-done-ic"><Icon name="checkCircle" /></div>
      <h1>{t('Your program is ready')}</h1>
      <p className="muted">{t('{0} days a week. It is in your plan, and Home shows what to do each day.', done.summary.days)}</p>
    </div>
    {done.schedule.map(([day, id]) => {
      const r = done.routines.find(x => x.id === id)
      return <div className="card" key={day}>
        <div className="lbl2" style={{ marginBottom: 4 }}>{t(DAYN[day])}</div>
        <div className="ttl" style={{ fontWeight: 600, marginBottom: 6 }}>{r.name}</div>
        {r.ex.map(e => <div key={e.id} className="wz-ex"><span>{exerciseNameText(EXIDX[e.id])}</span><span className="muted small">{e.sets} × {e.reps}{e.weight ? ' · ' + fmtNum(e.weight) + ' kg' : ''}</span></div>)}
      </div>
    })}
    <Button variant="primary" onClick={() => nav('/home')}>{t('Go to Home')}</Button>
    <div style={{ height: 24 }} />
  </div>

  return <div className="narrow wz">
    <div className="hdr">
      <button className="iconbtn" onClick={() => (step ? setStep(step - 1) : nav(-1))} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Coach')}</h1><div className="sub">{t('Step {0} of {1}', step + 1, steps.length)}</div></div>
    </div>
    <div className="wz-progress"><span style={{ width: ((step + 1) / steps.length * 100) + '%' }} /></div>
    <h2 className="wz-q">{cur.title}</h2>
    {cur.sub && <p className="muted wz-sub">{cur.sub}</p>}
    {cur.body}
    {(cur.key === 'gear' || cur.key === 'bells' || cur.key === 'body' || cur.ok && step < steps.length - 1) && <div className="wz-next">
      <Button variant="primary" disabled={!cur.ok} onClick={() => (last ? finish() : setStep(step + 1))}>{last ? t('Build my program') : t('Next')}</Button>
    </div>}
  </div>
}
