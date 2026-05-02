import { computed, provide } from 'vue'
import { useCheckStore }        from '@/services/web-checker/composables/useCheckStore.js'
import { useCheckRunner }       from '@/services/web-checker/composables/useCheckRunner.js'
import { useModuleLoader }      from '@/composables/loaders/useModuleLoader.js'
import { useModuleOverlay }     from '@/composables/overlay/useModuleOverlay.js'
import { useVisibilityWatcher } from '@/services/web-checker/composables/useVisibilityWatcher.js'
import { useModuleAttributes }  from '@/services/web-checker/composables/useModuleAttributes.js'

const EMPTY_RESULT = { status: 'idle', errors: [], warnings: [], items: [], errorCount: 0, warningCount: 0 }

export function useModuleSetup(moduleId, overlayConfig = null, allowChatBot = false) {
  const { state, setRunning, setResult, setCheckedTab } = useCheckStore()
  const { injectHelper, runChecker }                    = useCheckRunner()
  const { modules }                      = useModuleLoader('web-checker')

  const result = computed(() => state.results[moduleId] ?? EMPTY_RESULT)

  async function recheck() {
    const mod = modules.find(m => m.id === moduleId)
    if (!mod) return

    let tabId = state.checkedTabId
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.url || ['chrome://', 'chrome-extension://', 'edge://'].some(p => tab.url.startsWith(p))) return
      setCheckedTab(tab)
      tabId = tab.id
    }

    setRunning(moduleId)
    try {
      await injectHelper(tabId)
      const [res] = await runChecker(tabId, mod)
      setResult(moduleId, res.result ?? { errors: [], warnings: [] })
    } catch (e) {
      setResult(moduleId, { errors: [{ message: e.message }], warnings: [] })
    }
  }

  const moduleOverlay        = useModuleOverlay(moduleId, overlayConfig)
  const moduleOverlayWithBot = { ...moduleOverlay, allowChatBot }
  provide('moduleOverlay', moduleOverlayWithBot)

  useVisibilityWatcher(moduleId)
  useModuleAttributes(moduleId)

  return { result, moduleOverlay: moduleOverlayWithBot, recheck }
}