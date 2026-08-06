import { ref, onMounted, onUnmounted } from 'vue'

const tabId  = ref(null)
const tabUrl = ref('')
let listenerCount = 0

async function refresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId.value  = tab?.id ?? null
    tabUrl.value = tab?.url ?? ''
  } catch {
    tabId.value = null
    tabUrl.value = ''
  }
}

function onActivated()             { refresh() }
function onUpdated(_id, info, tab) { if (tab?.active && info.url) refresh() }

/**
 * One-shot active-tab lookup for non-component code (e.g. chatbot providers).
 * Returns `{ id, url, host }`; host is '' when the tab has no parseable URL.
 */
export async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    let host = ''
    try { host = tab?.url ? new URL(tab.url).host : '' } catch {}
    return { id: tab?.id ?? null, url: tab?.url ?? '', host }
  } catch {
    return { id: null, url: '', host: '' }
  }
}

/**
 * Brings the pinned tab back to the front. Falls back to any tab on the same
 * host, and finally opens a fresh one — so a closed tab never strands the chat.
 *
 * @param {{ host: string, tabId?: number|null, url?: string }} target
 */
export async function focusOrOpenTab({ host, tabId, url }) {
  const matchesHost = (tab) => {
    try { return tab?.url ? new URL(tab.url).host === host : false } catch { return false }
  }

  const activate = async (tab) => {
    await chrome.tabs.update(tab.id, { active: true })
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
    return true
  }

  if (tabId != null) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (matchesHost(tab)) return activate(tab)
    } catch {}
  }

  try {
    const all = await chrome.tabs.query({})
    const hit = all.find(matchesHost)
    if (hit) return activate(hit)
  } catch {}

  try {
    await chrome.tabs.create({ url: url || `https://${host}` })
    return true
  } catch {
    return false
  }
}

export function useActiveTab() {
  onMounted(() => {
    if (listenerCount === 0) {
      chrome.tabs.onActivated.addListener(onActivated)
      chrome.tabs.onUpdated.addListener(onUpdated)
    }
    listenerCount++
    refresh()
  })
  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  })
  return { tabId, tabUrl }
}
