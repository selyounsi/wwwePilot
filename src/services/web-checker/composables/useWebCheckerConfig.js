import { reactive, computed } from 'vue'
import { createSettingsStore } from '@/composables/settings/createSettingsStore.js'
import { API } from '@/config/api.js'

const STORAGE_KEY = 'wp-web-checker-config-cache'

// Offline fallback. Lives here only so the module isn't completely empty
// when the backend is unreachable AND nothing is cached yet. Everything
// else is server-driven — edit _apps/backend/src/config/web-checker/.
const FALLBACK = {
  global: { ignoreSelectors: ['.WidgetSealContainer'] },
  modules: {},
}

const state = reactive({
  config:    { ...FALLBACK },
  updatedAt: 0,
  source:    'fallback', // 'fallback' | 'cache' | 'network'
})

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  onHydrate(stored, s) {
    if (stored?.config?.global && stored?.config?.modules) {
      s.config    = stored.config
      s.updatedAt = stored.updatedAt ?? Date.now()
      s.source    = 'cache'
    }
  },
  onSerialize(s) {
    return { config: s.config, updatedAt: s.updatedAt }
  },
})

let inflight = null
async function fetchFromBackend() {
  if (inflight) return inflight
  inflight = (async () => {
    // Lazy import to avoid an import-cycle through the apiClient chain.
    const { reportFailure, reportSuccess } = await import('@/composables/useBackendStatus.js')
    try {
      const res = await fetch(`${API.config.url}/web-checker`, { credentials: 'omit' })
      reportSuccess()
      if (!res.ok) return
      const data = await res.json()
      if (!data?.global || !data?.modules) return
      state.config    = { global: data.global, modules: data.modules }
      state.updatedAt = Date.now()
      state.source    = 'network'
    } catch (e) {
      reportFailure(e)
    } finally {
      inflight = null
    }
  })()
  return inflight
}

let refreshTimer = null
async function refresh() {
  await hydrationPromise
  await fetchFromBackend()
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 3600_000)
}

const ignoreSelectors = computed(() => state.config.global?.ignoreSelectors ?? [])

export function whenWebCheckerConfigReady() {
  refresh()
  return hydrationPromise
}

export function useWebCheckerConfig() {
  refresh()
  return {
    state,
    ignoreSelectors,
    getModule: (id) => state.config.modules?.[id] ?? {},
    refresh: fetchFromBackend,
  }
}
