import { reactive } from 'vue'
import { createSettingsStore } from './settings/createSettingsStore.js'
import { API } from '@/config/api.js'

const STORAGE_KEY = 'wp-feature-flags-cache'

// Default-allow: when we have no cached state and no network response yet,
// every flag is considered enabled. Safer than hiding features on first paint.
const state = reactive({
  flags:     {},
  updatedAt: 0,
  source:    'fallback',
})

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  onHydrate(stored, s) {
    if (stored && typeof stored.flags === 'object') {
      s.flags     = stored.flags
      s.updatedAt = stored.updatedAt ?? Date.now()
      s.source    = 'cache'
    }
  },
  onSerialize(s) {
    return { flags: s.flags, updatedAt: s.updatedAt }
  },
})

let inflight = null
async function fetchFromBackend() {
  if (inflight) return inflight
  inflight = (async () => {
    const { reportFailure, reportSuccess } = await import('@/composables/useBackendStatus.js')
    try {
      const res = await fetch(`${API.config.url}/feature-flags`, { credentials: 'omit' })
      reportSuccess()
      if (!res.ok) return
      const data = await res.json()
      if (!data?.flags) return
      state.flags     = data.flags
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
  // Refresh every 5 min so admin toggles propagate without restart.
  refreshTimer = setTimeout(refresh, 5 * 60_000)
}

/** Default-allow: unknown flag = enabled. Only an explicit `false` disables. */
function isEnabled(key) {
  return state.flags[key] !== false
}

export function whenFeatureFlagsReady() {
  refresh()
  return hydrationPromise
}

export function useFeatureFlags() {
  refresh()
  return { state, isEnabled, refresh: fetchFromBackend }
}
