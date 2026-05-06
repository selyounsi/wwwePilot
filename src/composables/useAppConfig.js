import { reactive, computed, watch } from 'vue'
import { createSettingsStore } from './settings/createSettingsStore.js'
import { useAuth, whenAuthHydrated } from './auth/useAuth.js'
import { apiJson } from './auth/apiClient.js'
import { API } from '@/config/api.js'

const state = reactive({
  liveEditor: {
    cms4ProdHost: '',
    cms4ProdBase: '',
    cms4Staging:  '',
  },
  loadedAt: 0,
})

const { hydrationPromise } = createSettingsStore('wp-app-config', {
  state,
  version: 1,
  onHydrate(stored, s) {
    if (!stored) return
    if (stored.liveEditor) Object.assign(s.liveEditor, stored.liveEditor)
    s.loadedAt = stored.loadedAt ?? 0
  },
  onSerialize(s) {
    return { liveEditor: { ...s.liveEditor }, loadedAt: s.loadedAt }
  },
})

let inflight = null
async function refresh() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const data = await apiJson(`${API.config.url}/links`)
      if (data?.liveEditor) Object.assign(state.liveEditor, data.liveEditor)
      state.loadedAt = Date.now()
    } catch (e) {
      console.warn('[useAppConfig] refresh failed', e.message)
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

export async function whenAppConfigHydrated() {
  await hydrationPromise
  await whenAuthHydrated()
  setupAuthWatcher()
}

export function useAppConfig() {
  return {
    state,
    liveEditor: computed(() => state.liveEditor),
    refresh,
  }
}
