import { reactive, computed, watch } from 'vue'
import { useAuth, whenAuthHydrated } from './auth/useAuth.js'
import { apiJson } from './auth/apiClient.js'
import { API } from '@/config/api.js'
import { compareVersions } from '@/utils/version.js'

const state = reactive({
  current:     chrome.runtime?.getManifest?.()?.version ?? '0.0.0',
  latest:      null,
  releasedAt:  null,
  downloadUrl: null,
  releases:    [],
  loadedAt:    0,
  error:       null,
})

let inflight = null
async function refresh() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const [meta, history] = await Promise.all([
        apiJson(API.version.url),
        apiJson(`${API.version.url}/releases`).catch(() => ({ releases: [] })),
      ])
      state.latest      = meta?.latest ?? null
      state.releasedAt  = meta?.releasedAt ?? null
      state.downloadUrl = meta?.downloadUrl ?? null
      state.releases    = Array.isArray(history?.releases) ? history.releases : []
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
    compareVersions,
  }
}
