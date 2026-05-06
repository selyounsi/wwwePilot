import { computed, provide } from 'vue'
import { useCheckStore }        from '@/services/web-checker/composables/useCheckStore.js'
import { useCheckRunner }       from '@/services/web-checker/composables/useCheckRunner.js'
import { useModuleLoader }      from '@/composables/loaders/useModuleLoader.js'
import { useModuleOverlay }     from '@/composables/overlay/useModuleOverlay.js'
import { useVisibilityWatcher } from '@/services/web-checker/composables/useVisibilityWatcher.js'
import { useModuleAttributes }  from '@/services/web-checker/composables/useModuleAttributes.js'

const EMPTY_RESULT = { status: 'idle', errors: [], warnings: [], items: [], errorCount: 0, warningCount: 0 }

export function useModuleSetup(moduleId, overlayConfig = null, allowChatBot = false, actions = {}) {
  const { state, setRunning, setResult, setCheckedTab } = useCheckStore()
  const { injectHelper, runChecker }                    = useCheckRunner()
  const { modules }                      = useModuleLoader('web-checker')

  const result = computed(() => state.results[moduleId] ?? EMPTY_RESULT)

  async function recheck({ activeTab = false } = {}) {
    const mod = modules.find(m => m.id === moduleId)
    if (!mod) return

    let tabId
    if (activeTab) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.url || ['chrome://', 'chrome-extension://', 'edge://'].some(p => tab.url.startsWith(p))) return
      setCheckedTab(tab)
      tabId = tab.id
    } else {
      tabId = state.checkedTabId
      if (!tabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.url || ['chrome://', 'chrome-extension://', 'edge://'].some(p => tab.url.startsWith(p))) return
        setCheckedTab(tab)
        tabId = tab.id
      }
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

  const resolvedActions = {
    chatbot:       actions.chatbot       ?? allowChatBot ?? true,
    claudeExplain: actions.claudeExplain ?? true,
    ignore:        actions.ignore        ?? true,
    liveEditor:    actions.liveEditor    ?? true,
    altText:       actions.altText       ?? true,
  }

  const moduleOverlay        = useModuleOverlay(moduleId, overlayConfig)
  const moduleOverlayWithBot = {
    ...moduleOverlay,
    allowChatBot: resolvedActions.chatbot,
    actions:      resolvedActions,
    moduleId,
  }
  provide('moduleOverlay', moduleOverlayWithBot)

  useVisibilityWatcher(moduleId)
  useModuleAttributes(moduleId)

  return { result, moduleOverlay: moduleOverlayWithBot, recheck }
}