// The sheets behind the Daily screen's "My goals" card. Every choice is saved the moment it is
// made (no Save button to forget): a goal picker closes on a tap, the profile and equipment sheets
// write each change straight into the store.
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import { ACTIVITY } from '../lib/daily.js'
import { GEAR, PRESETS, myProfile, gearOn, withItem, presetEquipment, saveMyEquipment, gearCount } from '../lib/gear.js'
import { profileEquipment } from '../lib/equipment.js'
import { loadStarterPlan } from '../sheets.jsx'
import Icon from './Icon.jsx'
import { Button, NumberField, Segmented, Stepper } from './ui.jsx'

const update = (...a) => useStore.getState().update(...a)
const openSheet = (fn, opts) => useUI.getState().openSheet(fn, opts)
const toast = m => useUI.getState().toast(m)
const setGoal = (key, value) => update(s => { s.dailyGoals = { ...(s.dailyGoals || {}), [key]: value } })
const setBody = (key, value) => update(s => { s.bodyInfo = { ...(s.bodyInfo || {}), [key]: value } })

/* --------------------------------- goal picker --------------------------------- */

// One goal: a few common values to tap, an "automatic" choice where the app can work it out,
// and your own number. `options` are { value, label, sub }; `apply(option)` saves it.
function GoalPicker({ title, note, options, isOn, apply, custom, close }) {
  const S = useStore(s => s.S)
  return <>
    <h3>{title}</h3>
    {note && <div className="muted small" style={{ marginBottom: 10 }}>{note}</div>}
    <div className="dly-list">
      {options.map(o => {
        const on = isOn(o, S)
        return <button key={String(o.value) + o.label} className={'dly-opt' + (on ? ' on' : '')} onClick={() => { apply(o); toast(t('Saved')); close() }}>
          <span><span>{o.label}</span>{o.sub && <span className="dly-opt-sub">{o.sub}</span>}</span>
          {on && <Icon name="check" />}
        </button>
      })}
    </div>
    {custom && <CustomValue {...custom} close={close} />}
  </>
}

function CustomValue({ label, unit, value, start, step, min, max, decimal, save, close }) {
  const S = useStore(s => s.S)
  const v = value(S)
  return <div className="dly-custom">
    <div className="muted small">{label}</div>
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      <Stepper value={v ?? start ?? min} step={step} min={min} max={max} decimal={decimal} unit={unit} onChange={n => save(n)} ariaLabel={label} />
      <Button size="sm" variant="tinted" onClick={() => { if (v == null) save(start ?? min); toast(t('Saved')); close() }}>{t('Done')}</Button>
    </div>
  </div>
}

export function waterSheet() {
  const L = [1.5, 2, 2.5, 3, 3.5, 4]
  openSheet(close => <GoalPicker close={close} title={t('Water goal')}
    note={t('About 35 ml per kg of body weight a day, more on training days and in the heat.')}
    options={L.map(l => ({ value: l * 1000, label: fmtNum(l) + ' L', sub: t('{0} glasses', Math.round(l * 4)) }))}
    isOn={(o, S) => (S.dailyGoals?.water ?? 2500) === o.value}
    apply={o => setGoal('water', o.value)}
    custom={{ label: t('Your own'), unit: 'ml', step: 250, min: 500, max: 8000, decimal: false, value: S => S.dailyGoals?.water ?? 2500, save: n => setGoal('water', n) }} />)
}

export function stepsSheet() {
  const N = [5000, 7500, 10000, 12000, 15000]
  openSheet(close => <GoalPicker close={close} title={t('Step goal')}
    options={N.map(n => ({ value: n, label: fmtNum(n), sub: n === 10000 ? t('The classic') : null }))}
    isOn={(o, S) => (S.dailyGoals?.steps ?? 10000) === o.value}
    apply={o => setGoal('steps', o.value)}
    custom={{ label: t('Your own'), unit: '', step: 500, min: 1000, max: 40000, decimal: false, value: S => S.dailyGoals?.steps ?? 10000, save: n => setGoal('steps', n) }} />)
}

export function sleepSheet() {
  const H = [6, 6.5, 7, 7.5, 8, 8.5, 9]
  openSheet(close => <GoalPicker close={close} title={t('Sleep goal')}
    note={t('Adults do best on 7 to 9 hours.')}
    options={H.map(h => ({ value: h, label: fmtNum(h) + ' ' + t('h') }))}
    isOn={(o, S) => (S.dailyGoals?.sleep ?? 8) === o.value}
    apply={o => setGoal('sleep', o.value)} />)
}

export function proteinSheet(kg, auto) {
  const PER = [[1.6, 'Keep muscle'], [2.0, 'Build muscle or cut'], [2.2, 'High, for hard training']]
  openSheet(close => <GoalPicker close={close} title={t('Protein goal')}
    note={kg ? t('Worked out from your weight, {0} kg.', fmtNum(Math.round(kg * 10) / 10)) : t('Log your weight to work it out from your body.')}
    options={[
      { value: 'auto', label: t('Automatic'), sub: auto ? t('{0} g a day, from your weight and goal', fmtNum(auto)) : t('Needs your weight') },
      ...PER.map(([p, l]) => ({ value: p, label: fmtNum(p) + ' g/kg' + (kg ? ' · ' + fmtNum(Math.round(kg * p)) + ' g' : ''), sub: t(l) })),
    ]}
    isOn={(o, S) => {
      const g = S.dailyGoals || {}
      if (g.protein != null) return false
      return o.value === 'auto' ? g.proteinPerKg == null : g.proteinPerKg === o.value
    }}
    apply={o => update(s => { s.dailyGoals = { ...(s.dailyGoals || {}), protein: null, proteinPerKg: o.value === 'auto' ? null : o.value } })}
    custom={{ label: t('A fixed amount'), unit: 'g', step: 5, min: 40, max: 400, decimal: false, start: auto, value: S => S.dailyGoals?.protein ?? null, save: n => setGoal('protein', n) }} />)
}

export function kcalSheet(energy) {
  openSheet(close => <GoalPicker close={close} title={t('Calorie goal')}
    note={energy ? t('Your body uses about {0} kcal a day with your activity.', fmtNum(energy.tdee)) : t('Enter your height and age to work it out.')}
    options={energy ? [
      { value: 'auto', label: t('Automatic'), sub: t('{0} kcal, from your goal', fmtNum(energy.target)) },
      { value: energy.tdee - 500, label: fmtNum(energy.tdee - 500) + ' kcal', sub: t('Lose about 0.5 kg a week') },
      { value: energy.tdee, label: fmtNum(energy.tdee) + ' kcal', sub: t('Keep your weight') },
      { value: energy.tdee + 300, label: fmtNum(energy.tdee + 300) + ' kcal', sub: t('Build muscle slowly') },
    ] : [{ value: 'auto', label: t('Automatic'), sub: t('Needs your height and age') }]}
    isOn={(o, S) => o.value === 'auto' ? S.dailyGoals?.kcal == null : S.dailyGoals?.kcal === o.value}
    apply={o => setGoal('kcal', o.value === 'auto' ? null : o.value)}
    custom={{ label: t('Your own'), unit: 'kcal', step: 50, min: 1200, max: 6000, decimal: false, start: energy?.target, value: S => S.dailyGoals?.kcal ?? null, save: n => setGoal('kcal', n) }} />)
}

/* --------------------------------- profile --------------------------------- */

const ACT_LABEL = ['Sitting most of the day', 'Light: 1 to 3 workouts a week', 'Moderate: 3 to 5 a week', 'Active: 6 to 7 a week', 'Very active: physical job and training']

function ProfileSheet({ close }) {
  const b = useStore(s => s.S.bodyInfo) || {}
  const activity = b.activity || 1.375
  return <>
    <h3>{t('About you')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Used for your calorie and protein goals. Saved as you change it.')}</div>
    <div className="dly-field"><span>{t('Height')}</span>
      <NumberField value={b.height ?? null} nullable decimal={false} placeholder="175" onChange={v => setBody('height', v || null)} /><i>cm</i></div>
    <div className="dly-field"><span>{t('Age')}</span>
      <NumberField value={b.age ?? null} nullable decimal={false} placeholder="25" onChange={v => setBody('age', v || null)} /><i>{t('years')}</i></div>
    <div style={{ height: 10 }} />
    <Segmented value={b.sex || 'male'} onChange={v => setBody('sex', v)} options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} />
    <div className="muted small" style={{ margin: '16px 0 6px' }}>{t('Goal')}</div>
    <Segmented value={b.goal || 'keep'} onChange={v => setBody('goal', v)} options={[{ value: 'lose', label: t('Lose fat') }, { value: 'keep', label: t('Maintain') }, { value: 'gain', label: t('Build muscle') }]} />
    <div className="muted small" style={{ margin: '16px 0 6px' }}>{t('Activity')}</div>
    <div className="dly-list">
      {ACTIVITY.map((a, i) => <button key={a} className={'dly-opt' + (activity === a ? ' on' : '')} onClick={() => setBody('activity', a)}>{t(ACT_LABEL[i])}{activity === a && <Icon name="check" />}</button>)}
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}
export const profileSheet = () => openSheet(close => <ProfileSheet close={close} />)

/* --------------------------------- equipment --------------------------------- */

function GearSheet({ close }) {
  const S = useStore(s => s.S)
  const prof = myProfile(S)
  const save = eq => update(s => { saveMyEquipment(s, eq, t('My equipment')) })
  const toggle = item => save(withItem(prof ? profileEquipment(prof) : [], item, !gearOn(prof, item)))
  return <>
    <h3>{t('My equipment')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('Tap what you have. Suggestions, the exercise list and your plan follow it. Body-weight exercises are always there.')}</div>
    <div className="gear-presets">
      {PRESETS.map(p => <button key={p.key} className="gear-preset" onClick={() => { save(presetEquipment(p)); toast(t('Saved')) }}>{t(p.label)}</button>)}
    </div>
    {GEAR.map(g => <div key={g.group}>
      <div className="dly-slot-t">{t(g.group)}</div>
      <div className="gear-grid">
        {g.items.map(i => {
          const on = gearOn(prof, i)
          return <button key={i.key} className={'gear-tile' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(i)}>
            <Icon name={i.icon} /><span>{t(i.label)}</span>{on && <Icon name="check" className="gear-ok" />}
          </button>
        })}
      </div>
    </div>)}
    <div style={{ height: 14 }} />
    <Button variant="primary" icon="clipboard" onClick={() => { close(); planSheet() }}>{t('Build my plan with this equipment')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={close}>{t('Done')}</Button>
  </>
}
export const gearSheet = () => openSheet(close => <GearSheet close={close} />)
export const gearSummary = S => {
  const p = myProfile(S)
  return p ? t('{0} selected', gearCount(p)) : t('Not set')
}

/* --------------------------------- plan --------------------------------- */

const PLANS = [
  ['full-body', 'Full Body', '3 days a week, the whole body each time. Best to start with.'],
  ['upper-lower', 'Upper / Lower', '4 days a week, upper body and legs on their own days.'],
  ['ppl', 'Push / Pull / Legs', '6 days a week, for when you train a lot.'],
  ['5x5', '5×5', '3 days a week on the big barbell lifts. Needs a barbell.'],
]

function PlanSheet({ close }) {
  const S = useStore(s => s.S)
  const prof = myProfile(S)
  return <>
    <h3>{t('A plan for your equipment')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>
      {prof ? t('Exercises you cannot do with your equipment are swapped for ones you can. Your own routines stay.') : t('Pick your equipment first, so the plan only has exercises you can do.')}
    </div>
    {!prof && <><Button variant="tinted" icon="kettlebell" onClick={() => { close(); gearSheet() }}>{t('My equipment')}</Button><div style={{ height: 12 }} /></>}
    <div className="dly-list">
      {PLANS.map(([id, name, about]) => <button key={id} className="dly-opt" onClick={() => {
        if (loadStarterPlan(id, prof || undefined)) close()
      }}><span><span>{t(name)}</span><span className="dly-opt-sub">{t(about)}</span></span><Icon name="chevronRight" /></button>)}
    </div>
  </>
}
export const planSheet = () => openSheet(close => <PlanSheet close={close} />)
