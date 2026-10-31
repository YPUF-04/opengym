// "Get the app": the Android APK from this fork's releases, and the steps to put the web app on
// an iPhone's home screen. Shown on Home in a browser until dismissed or installed, and as rows in
// Settings. Never inside the phone app itself.
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { RELEASES_PAGE } from '../lib/update.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export const isStandalone = () => {
  try { return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) } catch { return false }
}

export const openAndroidDownload = () => window.open(RELEASES_PAGE, '_blank', 'noopener')

function IphoneSteps({ close }) {
  const steps = [
    t('Open this page in Safari (not Chrome).'),
    t('Tap the Share button at the bottom (the square with an arrow).'),
    t('Scroll down and tap Add to Home Screen, then Add.'),
    t('Open Gearly from the home screen: full screen, works offline.'),
  ]
  return <>
    <h3>{t('Install on iPhone')}</h3>
    <ol className="gta-steps">{steps.map((s, i) => <li key={i}><span className="gta-n">{i + 1}</span><span>{s}</span></li>)}</ol>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Your data stays on this phone. Export a backup in Settings now and then.')}</div>
    <Button variant="primary" onClick={close}>{t('Got it')}</Button>
  </>
}
export const iphoneStepsSheet = () => useUI.getState().openSheet(close => <IphoneSteps close={close} />)

/** The Home card. */
export default function GetTheApp() {
  const S = useStore(s => s.S)
  if (S.hints?.getApp || isStandalone()) return null
  const dismiss = () => useStore.getState().update(s => { s.hints = { ...(s.hints || {}), getApp: true } })
  return <div className="card gta">
    <button className="iconbtn gta-x" onClick={dismiss} aria-label={t('Close')}><Icon name="xmark" /></button>
    <div className="gta-t">{t('Gearly on your phone')}</div>
    <div className="muted small" style={{ margin: '2px 0 12px' }}>{t('Install it like an app: on its own icon, full screen, also offline.')}</div>
    <div className="row" style={{ gap: 8 }}>
      <Button variant="primary" icon="download" onClick={openAndroidDownload}>{t('Android')}</Button>
      <Button icon="phoneScreen" onClick={iphoneStepsSheet}>{t('iPhone')}</Button>
    </div>
  </div>
}
