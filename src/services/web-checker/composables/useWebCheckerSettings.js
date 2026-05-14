import { reactive, computed } from 'vue'
import { createSettingsStore } from '@/composables/settings/createSettingsStore.js'
import { useIgnoreSelectors } from './useIgnoreSelectors.js'

const STORAGE_KEY = 'wp-web-checker-settings'

const state = reactive({
  customSelectors:  [],
  disabledBuiltins: [],
  defaultFilter:    null,
  showSearch:       false,
})

const { state: ignoreState } = useIgnoreSelectors()

const effectiveIgnoreSelectors = computed(() => [
  ...ignoreState.selectors.filter(s => !state.disabledBuiltins.includes(s)),
  ...state.customSelectors,
])

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  migrations: {},
  onHydrate(stored, state) {
    if (!stored || typeof stored !== 'object') return
    if (Array.isArray(stored.customSelectors))  state.customSelectors  = stored.customSelectors
    if (Array.isArray(stored.disabledBuiltins)) state.disabledBuiltins = stored.disabledBuiltins
    if (stored.defaultFilter !== undefined)     state.defaultFilter    = stored.defaultFilter
    if (typeof stored.showSearch === 'boolean') state.showSearch       = stored.showSearch
  },
  onSerialize(state) {
    return {
      customSelectors:  state.customSelectors,
      disabledBuiltins: state.disabledBuiltins,
      defaultFilter:    state.defaultFilter,
      showSearch:       state.showSearch,
    }
  },
})

/**
 * Promise, die resolved sobald die persistierten Web-Checker-Settings aus
 * `chrome.storage.local` geladen wurden.
 *
 * @returns {Promise<void>}
 */
export function whenWebCheckerSettingsHydrated() {
  return hydrationPromise
}

/**
 * Web-Checker-spezifische Settings: Ignore-Selektoren (Built-ins +
 * User-Custom) und Default-Filter für die Item-Listen. State ist ein
 * Singleton, persistiert in `chrome.storage.local` unter `wp-web-checker-settings`.
 *
 * @returns {{
 *   state: object,
 *   builtins: string[],
 *   effectiveIgnoreSelectors: import('vue').ComputedRef<string[]>,
 *   addCustomSelector: (sel: string) => void,
 *   removeCustomSelector: (sel: string) => void,
 *   isBuiltinEnabled: (sel: string) => boolean,
 *   toggleBuiltin: (sel: string) => void,
 *   setDefaultFilter: (filter: string | null) => void,
 * }}
 */
export function useWebCheckerSettings() {
  function addCustomSelector(sel) {
    const trimmed = sel.trim()
    if (!trimmed) return
    if (state.customSelectors.includes(trimmed)) return
    if (ignoreState.selectors.includes(trimmed)) return
    state.customSelectors.push(trimmed)
  }

  function removeCustomSelector(sel) {
    state.customSelectors = state.customSelectors.filter(s => s !== sel)
  }

  function isBuiltinEnabled(sel) {
    return !state.disabledBuiltins.includes(sel)
  }

  function toggleBuiltin(sel) {
    if (state.disabledBuiltins.includes(sel)) {
      state.disabledBuiltins = state.disabledBuiltins.filter(s => s !== sel)
    } else {
      state.disabledBuiltins.push(sel)
    }
  }

  function setDefaultFilter(filter) {
    const allowed = [null, 'issues', 'errors', 'warnings', 'all']
    if (!allowed.includes(filter)) return
    state.defaultFilter = filter
  }

  function setShowSearch(value) {
    state.showSearch = !!value
  }

  return {
    state,
    builtins: computed(() => ignoreState.selectors),
    effectiveIgnoreSelectors,
    addCustomSelector, removeCustomSelector,
    isBuiltinEnabled, toggleBuiltin,
    setDefaultFilter,
    setShowSearch,
  }
}
