export const types = ['GET_NETWORK_ERRORS']

const KEY = (tabId) => `console-net-${tabId}`
const MAX = 500

const SKIP_CODES = new Set(['net::ERR_CACHE_MISS', 'net::ERR_ABORTED'])

chrome.webRequest.onErrorOccurred.addListener(async (d) => {
  if (d.tabId < 0) return
  if (SKIP_CODES.has(d.error)) return
  const key  = KEY(d.tabId)
  const data = (await chrome.storage.session.get(key))[key] || []
  const existing = data.find(e => e.url === d.url && e.method === d.method)
  if (existing) {
    existing.error     = d.error
    existing.type      = d.type
    existing.timestamp = Date.now()
  } else {
    data.push({
      url:       d.url,
      method:    d.method,
      type:      d.type,
      error:     d.error,
      timestamp: Date.now(),
    })
    if (data.length > MAX) data.splice(0, data.length - MAX)
  }
  await chrome.storage.session.set({ [key]: data })
}, { urls: ['<all_urls>'] })

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === 'loading') await chrome.storage.session.remove(KEY(tabId))
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await chrome.storage.session.remove(KEY(tabId))
})

export async function handle(msg, sendResponse, sender) {
  const tabId = sender?.tab?.id ?? msg.tabId
  if (tabId == null) { sendResponse([]); return }
  const key  = KEY(tabId)
  const data = (await chrome.storage.session.get(key))[key] || []
  sendResponse(data)
}
