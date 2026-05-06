import { reactive, computed } from 'vue'
import { createSettingsStore } from '@/composables/settings/createSettingsStore.js'
import { useModuleLoader }     from '@/composables/loaders/useModuleLoader.js'

const STORAGE_KEY = 'wp-chatbot-providers'

const state = reactive({
  // missing key = enabled by default
  disabled: {},
})

function reset() { state.disabled = {} }

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  userScoped: true,
  resetToDefaults: reset,
  onHydrate(stored, s) {
    if (stored?.disabled && typeof stored.disabled === 'object') s.disabled = { ...stored.disabled }
  },
  onSerialize(s) {
    return { disabled: s.disabled }
  },
})

/** Resolves once the per-user provider toggles have been hydrated. */
export function whenChatbotProvidersHydrated() {
  return hydrationPromise
}

/**
 * Per-user enable/disable toggle for chatbot providers. Combines with the
 * module.json `active` flag — a provider is effectively available only if
 * both layers say yes.
 */
export function useChatbotProviders() {
  const { modules } = useModuleLoader('chatbot')

  function isEnabled(id) {
    const mod = modules.find(m => m.id === id)
    if (!mod) return false
    return state.disabled[id] !== true
  }

  function setEnabled(id, enabled) {
    if (enabled) delete state.disabled[id]
    else         state.disabled[id] = true
  }

  const enabledModules = computed(() => modules.filter(m => isEnabled(m.id)))
  const anyEnabled     = computed(() => enabledModules.value.length > 0)

  return { state, modules, enabledModules, anyEnabled, isEnabled, setEnabled }
}
