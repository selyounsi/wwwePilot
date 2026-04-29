import { useCheckStore }     from './useCheckStore.js'
import { useCheckRunner }    from './useCheckRunner.js'
import { useSiteCheckStore } from './useSiteCheckStore.js'

export function useTabWatcher(modules) {
  const { state, setRunning, setResult, setCheckedTab, markCheckedAt } = useCheckStore()
  const { injectHelper }                                               = useCheckRunner()
  const siteCheckStore                                                 = useSiteCheckStore()

  async function runModule(tabId, tabUrl, mod) {
    setRunning(mod.id)
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func:   mod.checker,
      })
      const result = res.result ?? { errors: [], warnings: [] }
      setResult(mod.id, result)
      siteCheckStore.syncFromSingleCheck(tabUrl, mod.id, result)
    } catch (e) {
      const result = { errors: [{ message: e.message }], warnings: [] }
      setResult(mod.id, result)
      siteCheckStore.syncFromSingleCheck(tabUrl, mod.id, result)
    }
  }

  async function recheckModules(tabId) {
    const reloadModules = modules.filter(m => m.checkOnReload)
    if (!reloadModules.length) return

    try {
      const tab = await chrome.tabs.get(tabId)
      if (!tab?.url || ['chrome://', 'chrome-extension://', 'edge://'].some(p => tab.url.startsWith(p))) return

      // tab.url may be a live-editor URL after reload; the audit context
      // is the original page we ran on
      const auditedUrl = state.checkedUrl

      await injectHelper(tab.id)
      reloadModules.forEach(mod => setRunning(mod.id))
      await Promise.all(reloadModules.map(mod => runModule(tab.id, auditedUrl ?? tab.url, mod)))

      if (auditedUrl && siteCheckStore.state.urls.includes(auditedUrl)) {
        markCheckedAt(tab)
      } else {
        setCheckedTab(tab)
      }
    } catch {}
  }

  function onTabUpdated(tabId, info) {
    if (tabId !== state.checkedTabId) return
    if (info.status === 'complete') recheckModules(tabId)
  }

  function onTabRemoved(tabId) {
    if (tabId === state.checkedTabId) useCheckStore().reset()
  }

  function start() {
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.tabs.onRemoved.addListener(onTabRemoved)
  }

  function stop() {
    chrome.tabs.onUpdated.removeListener(onTabUpdated)
    chrome.tabs.onRemoved.removeListener(onTabRemoved)
  }

  return { start, stop }
}