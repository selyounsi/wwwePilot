import { useCheckStore }  from './useCheckStore.js'
import { useCheckRunner } from './useCheckRunner.js'

export function useTabWatcher(modules) {
  const { state, setRunning, setResult, setCheckedTab } = useCheckStore()
  const { injectHelper }                                = useCheckRunner()

  async function runModule(tabId, mod) {
    setRunning(mod.id)
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func:   mod.checker,
      })
      setResult(mod.id, res.result ?? { errors: [], warnings: [] })
    } catch (e) {
      setResult(mod.id, { errors: [{ message: e.message }], warnings: [] })
    }
  }

  async function recheckModules(tabId) {
    const reloadModules = modules.filter(m => m.checkOnReload)
    if (!reloadModules.length) return

    try {
      const tab = await chrome.tabs.get(tabId)
      if (!tab?.url || ['chrome://', 'chrome-extension://', 'edge://'].some(p => tab.url.startsWith(p))) return

      await injectHelper(tab.id)
      reloadModules.forEach(mod => setRunning(mod.id))
      await Promise.all(reloadModules.map(mod => runModule(tab.id, mod)))
      setCheckedTab(tab)
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