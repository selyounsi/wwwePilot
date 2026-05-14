import { reactive } from 'vue'
import { createSettingsStore } from '@/composables/settings/createSettingsStore.js'
import { API } from '@/config/api.js'

const STORAGE_KEY = 'wp-ignore-selectors-cache'

// Tiny offline fallback so the module still has SOMETHING to ignore when
// the backend is unreachable and the cache is empty. Everything else comes
// from /api/config/ignore-selectors at runtime.
const FALLBACK_SELECTORS = [
  '.WidgetSealContainer',
]

const state = reactive({
  selectors: [...FALLBACK_SELECTORS],
  updatedAt: 0,
  source:    'fallback', // 'fallback' | 'cache' | 'network'
})

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  onHydrate(stored, s) {
    if (Array.isArray(stored?.selectors) && stored.selectors.length) {
      s.selectors = stored.selectors
      s.updatedAt = stored.updatedAt ?? Date.now()
      s.source    = 'cache'
    }
  },
  onSerialize(s) {
    return { selectors: s.selectors, updatedAt: s.updatedAt }
  },
})

let inflight = null
async function fetchFromBackend() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch(`${API.config.url}/ignore-selectors`, { credentials: 'omit' })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data?.selectors)) return
      state.selectors = data.selectors
      state.updatedAt = Date.now()
      state.source    = 'network'
    } catch {
    } finally {
      inflight = null
    }
  })()
  return inflight
}

let refreshScheduled = false
async function refresh() {
  if (refreshScheduled) return
  refreshScheduled = true
  await hydrationPromise
  await fetchFromBackend()
  // re-poll once per hour while the side panel is open
  setTimeout(() => { refreshScheduled = false; refresh() }, 3600_000)
}

export function whenIgnoreSelectorsReady() {
  refresh()
  return hydrationPromise
}

export function useIgnoreSelectors() {
  refresh()
  return { state, refresh: fetchFromBackend }
}
