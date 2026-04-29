import { ref, onMounted, onUnmounted } from 'vue'
import { useModuleLoader }    from '@/composables/loaders/useModuleLoader.js'
import { useCheckStore }      from '@/services/web-checker/composables/useCheckStore.js'
import { useCheckRunner }     from '@/services/web-checker/composables/useCheckRunner.js'
import { useSiteCheckStore }  from '@/services/web-checker/composables/useSiteCheckStore.js'
import { detectLiveEditor }   from '@/composables/liveEditor/useLiveEditorDetector.js'
import { moduleAppliesTo }    from '@/services/web-checker/composables/useUrlFilter.js'

export function useWebChecker() {
  const { modules }                                                         = useModuleLoader('web-checker')
  const { state, setRunning, setResult, setSkipped, setCheckedTab, reset } = useCheckStore()
  const { injectHelper }                                                    = useCheckRunner()
  const siteCheckStore                                                      = useSiteCheckStore()

  const isChecking = ref(false)
  const tabStatus  = ref('unchecked')

  async function updateTabStatus() {
    if (!state.checkedTabId) { tabStatus.value = 'unchecked'; return }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) { tabStatus.value = 'unchecked'; return }
    const editorStatus = await detectLiveEditor(tab.id, state.checkedUrl)
    if (editorStatus) { tabStatus.value = editorStatus; return }
    if (tab.id  !== state.checkedTabId) tabStatus.value = 'different-tab'
    else if (tab.url !== state.checkedUrl) tabStatus.value = 'url-changed'
    else                                   tabStatus.value = 'current'
  }

  async function switchToCheckedTab() {
    if (!state.checkedTabId) return
    await chrome.tabs.update(state.checkedTabId, { active: true })
  }

  function onTabActivated() { updateTabStatus() }
  function onTabUpdated(tabId, info) {
    if (tabId !== state.checkedTabId) { updateTabStatus(); return }
    if (info.status === 'loading' && tabStatus.value === 'current') tabStatus.value = 'reloaded'
    if (info.url && info.url !== state.checkedUrl) tabStatus.value = 'url-changed'
    if (info.status === 'complete') updateTabStatus()
  }
  function onTabRemoved(tabId) {
    if (tabId === state.checkedTabId) tabStatus.value = 'unchecked'
  }

  onMounted(() => {
    updateTabStatus()
    chrome.tabs.onActivated.addListener(onTabActivated)
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.tabs.onRemoved.addListener(onTabRemoved)
  })
  onUnmounted(() => {
    chrome.tabs.onActivated.removeListener(onTabActivated)
    chrome.tabs.onUpdated.removeListener(onTabUpdated)
    chrome.tabs.onRemoved.removeListener(onTabRemoved)
  })

  async function runModule(tabId, tabUrl, mod) {
    setRunning(mod.id)
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func:   mod.checker,
        args:   mod.apiConfig ? [mod.apiConfig] : [],
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

  async function runChecks(modulesToRun = modules, tabId = null) {
    let tab
    if (tabId) {
      ;[tab] = await chrome.tabs.get(tabId).then(t => [t]).catch(() => [null])
    } else {
      ;[tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    }

    if (!tab?.url || ['chrome://', 'chrome-extension://', 'edge://'].some(p => tab.url.startsWith(p))) {
      if (!tabId) alert('Diese Seite kann nicht geprüft werden.\nBitte öffne eine normale Webseite.')
      return
    }

    isChecking.value = true
    if (modulesToRun === modules) reset()
    await injectHelper(tab.id)

    const applicable = []
    for (const mod of modulesToRun) {
      if (moduleAppliesTo(mod, tab.url, 'singlePage')) applicable.push(mod)
      else setSkipped(mod.id, 'URL-Filter')
    }

    applicable.forEach(mod => setRunning(mod.id))
    await Promise.all(applicable.map(mod => runModule(tab.id, tab.url, mod)))

    setCheckedTab(tab)
    tabStatus.value  = 'current'
    isChecking.value = false
  }

  const errorCount   = id => state.results[id]?.errorCount   ?? null
  const warningCount = id => state.results[id]?.warningCount ?? null

  return { modules, state, isChecking, tabStatus, errorCount, warningCount, runChecks, switchToCheckedTab }
}