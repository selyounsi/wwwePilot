import { reactive, computed, watch } from 'vue'
import { useAuth, whenAuthHydrated } from './auth/useAuth.js'
import { apiJson } from './auth/apiClient.js'
import { API } from '@/config/api.js'

const state = reactive({
  current:     chrome.runtime?.getManifest?.()?.version ?? '0.0.0',
  latest:      null,
  releasedAt:  null,
  downloadUrl: null,
  loadedAt:    0,
  error:       null,
})

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0, db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}

let inflight = null
async function refresh() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const data = await apiJson(API.version.url)
      state.latest      = data?.latest ?? null
      state.releasedAt  = data?.releasedAt ?? null
      state.downloadUrl = data?.downloadUrl ?? null
      state.loadedAt    = Date.now()
      state.error       = null
    } catch (e) {
      state.error = e.message
    } finally {
      inflight = null
    }
  })()
  return inflight
}

let watcherSetup = false
function setupAuthWatcher() {
  if (watcherSetup) return
  watcherSetup = true
  const auth = useAuth()
  watch(
    () => auth.state.accessToken,
    (token) => { if (token) refresh() },
    { immediate: true },
  )
}

export async function whenExtensionVersionReady() {
  await whenAuthHydrated()
  setupAuthWatcher()
}

export function useExtensionVersion() {
  const hasUpdate = computed(() =>
    !!state.latest && compareVersions(state.latest, state.current) > 0
  )
  return {
    state,
    hasUpdate,
    refresh,
  }
}
