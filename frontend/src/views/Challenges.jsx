// Challenges (api/challenges.js): push-up weeks, plank battles and step races with friends on the
// same server. Start one and share its six-character code, or join with a friend's code; log what
// you did with a tap and watch the board. Needs a signed-in account on a server, so the personal
// (server-less) build explains that instead.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, Segmented, TextField } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'

const openSheet = fn => useUI.getState().openSheet(fn)
const toast = m => useUI.getState().toast(m)

// What each kind is called, how it is shown, and the quick amounts to log with one tap.
export const KIND_INFO = {
  pushups: { name: 'Push-ups', title: 'Push-up race', icon: 'arm', unit: 'reps', quick: [10, 20, 30, 50] },
  squats: { name: 'Squats', title: 'Squat race', icon: 'legs', unit: 'reps', quick: [10, 20, 30, 50] },
  situps: { name: 'Sit-ups', title: 'Sit-up race', icon: 'abs', unit: 'reps', quick: [10, 20, 30, 50] },
  pullups: { name: 'Pull-ups', title: 'Pull-up race', icon: 'pullup', unit: 'reps', quick: [3, 5, 10, 15] },
  plank: { name: 'Plank', title: 'Longest plank', icon: 'timer', unit: 'sec', quick: [] },
  steps: { name: 'Steps', title: 'Step race', icon: 'steps', unit: 'steps', quick: [1000, 2000, 5000] },
  workouts: { name: 'Workouts', title: 'Most workouts', icon: 'dumbbell', unit: 'count', quick: [1] },
}
const UNIT = { reps: 'reps', sec: 'sec', steps: 'steps', count: 'workouts' }

// The server answers in English; these are the ones a person can act on.
const ERRORS = {
  'no such code': 'No challenge has this code. Check it with your friend.',
  'this challenge has ended': 'This challenge has ended.',
  'this challenge is full': 'This challenge is full.',
  'too many challenges': 'You are in too many challenges. Leave one first.',
  'not signed in': 'Sign in first.',
}
const errText = e => t(ERRORS[e?.message] || 'Something went wrong. Try again.')

const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })

const daysLeft = end => Math.max(0, Math.ceil((end - Date.now()) / 86400000))

function CreateSheet({ close, onDone }) {
  const [kind, setKind] = useState('pushups')
  const [days, setDays] = useState(7)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const title = name.trim() || t(KIND_INFO[kind].title)
  return <>
    <h3>{t('Start a challenge')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('1. Pick what to compete in')}</div>
    <div className="gear-grid">
      {Object.entries(KIND_INFO).map(([k, i]) => <button key={k} className={'gear-tile' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>
        <Icon name={i.icon} /><span>{t(i.name)}</span>
      </button>)}
    </div>
    <div className="muted small" style={{ margin: '16px 0 6px' }}>{t('2. How long?')}</div>
    <Segmented value={days} onChange={setDays} options={[1, 7, 14, 30].map(d => ({ value: d, label: d === 1 ? t('1 day') : t('{0} days', d) }))} />
    <div className="muted small" style={{ margin: '16px 0 6px' }}>{t('3. A name (optional)')}</div>
    <TextField value={name} onChange={e => setName(e.target.value)} placeholder={t(KIND_INFO[kind].title)} maxLength={60} />
    <div style={{ height: 16 }} />
    <Button variant="primary" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        const r = await post('/api/challenges/create', { kind, days, name: title })
        close(); onDone(); shareSheet({ code: r.code, name: title })
      } catch (e) { toast(errText(e)); setBusy(false) }
    }}>{t('Start')}</Button>
  </>
}

function JoinSheet({ close, onDone }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return <>
    <h3>{t('Join with a code')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('Ask your friend for the 6-letter code of their challenge and type it here.')}</div>
    <TextField autoFocus className="ch-code-in" value={clean} onChange={e => setCode(e.target.value)} placeholder="ABC234" inputMode="text" autoCapitalize="characters" maxLength={8} />
    <div style={{ height: 14 }} />
    <Button variant="primary" disabled={busy || clean.length !== 6} onClick={async () => {
      setBusy(true)
      try { await post('/api/challenges/join', { code: clean }); close(); onDone(); toast(t('You are in!')) }
      catch (e) { toast(errText(e)); setBusy(false) }
    }}>{t('Join')}</Button>
  </>
}

function ShareSheet({ code, name, close }) {
  const text = t('Join my Gearly challenge "{0}" with the code {1}', name, code)
  return <div style={{ textAlign: 'center' }}>
    <h3>{t('Share the code')}</h3>
    <div className="muted small">{t('Your friends open Gearly, tap Challenges, then Join with a code.')}</div>
    <div className="ch-code">{code}</div>
    <Button variant="primary" icon="share" onClick={async () => {
      try {
        if (navigator.share) await navigator.share({ text })
        else { await navigator.clipboard.writeText(text); toast(t('Copied')) }
      } catch { /* dismissed */ }
    }}>{t('Send to friends')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={close}>{t('Done')}</Button>
  </div>
}
const shareSheet = c => openSheet(close => <ShareSheet code={c.code} name={c.name} close={close} />)

function LogSheet({ c, close, onDone }) {
  const info = KIND_INFO[c.kind] || KIND_INFO.pushups
  const [v, setV] = useState(null)
  const send = async value => {
    try { await post('/api/challenges/entry', { id: c.id, value }); onDone(); toast(t('Saved: {0}', fmtNum(value) + ' ' + t(UNIT[c.unit]))); close() }
    catch (e) { toast(errText(e)) }
  }
  return <>
    <h3>{c.kind === 'plank' ? t('How long did you hold it?') : t('How many did you do?')}</h3>
    {!!info.quick.length && <div className="ch-quick">{info.quick.map(q => <button key={q} className="ch-q" onClick={() => send(q)}>+{fmtNum(q)}</button>)}</div>}
    <div className="dly-field"><span>{c.kind === 'plank' ? t('Seconds') : t('Other amount')}</span>
      <NumberField value={v} onChange={setV} nullable decimal={false} placeholder="0" /><i>{t(UNIT[c.unit])}</i></div>
    <Button variant="primary" disabled={!v} onClick={() => send(v)}>{t('Save')}</Button>
  </>
}

function ChallengeCard({ c, reload }) {
  const info = KIND_INFO[c.kind] || KIND_INFO.pushups
  const me = c.board.find(r => r.me)
  const left = daysLeft(c.end)
  return <div className={'card ch' + (c.ended ? ' ended' : '')}>
    <div className="row between" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10, minWidth: 0 }}>
        <span className="lrow-i" style={{ background: 'var(--acc)' }}><Icon name={info.icon} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="ch-name">{c.name}</div>
          <div className="muted small">{c.ended ? t('Ended') : left <= 1 ? t('Last day') : t('{0} days left', left)} · {t(c.mode === 'best' ? 'best try counts' : 'everything adds up')}</div>
        </div>
      </div>
      <button className="ch-codechip" onClick={() => shareSheet(c)} aria-label={t('Share the code')}>{c.code}<Icon name="share" /></button>
    </div>

    <ol className="ch-board">
      {c.board.map((r, i) => <li key={i} className={r.me ? 'me' : ''}>
        <span className={'ch-place p' + r.place}>{r.place}</span>
        <span className="ch-who">{r.me ? t('You') : r.name}</span>
        <span className="ch-score">{fmtNum(r.score)} <small>{t(UNIT[c.unit])}</small></span>
      </li>)}
    </ol>
    {c.board.length === 1 && <div className="muted small" style={{ marginTop: 6 }}>{t('Only you so far. Share the code so friends can join.')}</div>}

    {!c.ended && <Button variant="primary" icon="plus" onClick={() => openSheet(close => <LogSheet c={c} close={close} onDone={reload} />)}>
      {c.kind === 'plank' ? t('Log my plank') : t('Log what I did')}
    </Button>}
    {!!c.today.length && <div className="ch-today">
      <span className="muted small">{t('Today')}:</span>
      {c.today.map(e => <button key={e.id} className="ch-entry" aria-label={t('Undo')} onClick={async () => {
        try { await post('/api/challenges/entry', { id: c.id, remove: e.id }); reload(); toast(t('Removed')) } catch (err) { toast(errText(err)) }
      }}>{fmtNum(e.value)} <Icon name="xmark" /></button>)}
    </div>}
    <div className="row between" style={{ marginTop: 8 }}>
      <span className="muted small">{me ? t('Your place: {0} of {1}', me.place, c.board.length) : ''}</span>
      <Button size="sm" variant="ghost" className="dim" onClick={() => confirmSheet({
        title: c.mine ? t('Delete this challenge?') : t('Leave this challenge?'),
        message: c.mine ? t('You started it, so it is removed for everyone.') : t('Your scores in it are removed.'),
        confirmText: c.mine ? t('Delete') : t('Leave'), danger: true,
        onConfirm: async () => { try { await post('/api/challenges/leave', { id: c.id }); reload() } catch (e) { toast(errText(e)) } },
      })}>{c.mine ? t('Delete') : t('Leave')}</Button>
    </div>
  </div>
}

export default function Challenges() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [list, setList] = useState(null)
  const [err, setErr] = useState(null)
  const reload = useCallback(() => {
    api('/api/challenges').then(r => { setList(r.challenges || []); setErr(null) }).catch(e => setErr(errText(e)))
  }, [])
  useEffect(() => { if (user) reload() }, [user, reload])

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/home" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Challenges')}</h1><div className="sub">{t('Compete with your friends')}</div></div>
    </div>

    {!user ? <div className="card">
      <div className="row" style={{ gap: 10, marginBottom: 8 }}>
        <span className="lrow-i" style={{ background: 'var(--acc)' }}><Icon name="trophy" /></span>
        <div className="ch-name">{t('Needs an account')}</div>
      </div>
      <div className="muted" style={{ lineHeight: 1.5 }}>{t('To race your friends, everyone needs an account on the same Gearly server, so the app can show each other’s scores. This version keeps everything on your phone only.')}</div>
      <div className="muted small" style={{ marginTop: 10 }}>{t('Once the server is set up, sign in there and this screen fills up.')}</div>
    </div> : <>
      <div className="ch-actions">
        <button className="ch-big" onClick={() => openSheet(close => <CreateSheet close={close} onDone={reload} />)}>
          <Icon name="flag" /><b>{t('Start a challenge')}</b><span>{t('Push-ups, squats, plank, steps')}</span>
        </button>
        <button className="ch-big" onClick={() => openSheet(close => <JoinSheet close={close} onDone={reload} />)}>
          <Icon name="key" /><b>{t('Join with a code')}</b><span>{t('A friend sends you 6 letters')}</span>
        </button>
      </div>
      {err && <div className="card muted">{err} <Button size="sm" variant="ghost" onClick={reload}>{t('Try again')}</Button></div>}
      {list && !list.length && !err && <div className="card muted" style={{ lineHeight: 1.5 }}>{t('No challenges yet. Start one and send the code to your friends, or join theirs.')}</div>}
      {(list || []).map(c => <ChallengeCard key={c.id} c={c} reload={reload} />)}
    </>}
  </div>
}
