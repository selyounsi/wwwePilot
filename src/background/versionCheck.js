import { API } from '@/config/api.js'
import { APP_NAME } from '@/config/app.js'
import { compareVersions } from '@/utils/version.js'

const ALARM_NAME       = 'version-check'
const POLL_PERIOD_MIN  = 60
const NOTIFIED_KEY     = 'version-check.notified-version'
const NOTIFICATION_ID  = 'wwwe-extension-update'

async function fetchLatest() {
  try {
    const res = await fetch(API.version.url, { credentials: 'omit' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.latest ?? null
  } catch {
    return null
  }
}

async function maybeNotify() {
  const installed = chrome.runtime.getManifest().version
  const latest    = await fetchLatest()
  if (!latest) return
  if (compareVersions(latest, installed) <= 0) return

  const { [NOTIFIED_KEY]: alreadyNotified } = await chrome.storage.local.get(NOTIFIED_KEY)
  if (alreadyNotified === latest) return

  chrome.notifications.create(NOTIFICATION_ID, {
    type:    'basic',
    iconUrl: chrome.runtime.getURL('icons/android-chrome-192x192.png'),
    title:   `${APP_NAME} — Update verfügbar`,
    message: `Neue Version ${latest} (installiert: ${installed}). Klicken zum Aktualisieren.`,
    priority: 1,
  })

  await chrome.storage.local.set({ [NOTIFIED_KEY]: latest })
}

async function openUpdatesPanel() {
  try {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] })
    if (win?.id != null) await chrome.sidePanel.open({ windowId: win.id })
  } catch {}
}

export function registerVersionCheck() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_PERIOD_MIN })

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) maybeNotify()
  })

  chrome.runtime.onStartup.addListener(maybeNotify)
  chrome.runtime.onInstalled.addListener(maybeNotify)

  chrome.notifications.onClicked.addListener((id) => {
    if (id !== NOTIFICATION_ID) return
    chrome.notifications.clear(id)
    openUpdatesPanel()
  })

  maybeNotify()
}
