import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  flags:   [],
  loading: false,
  error:   null,
})

async function fetchAll() {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/feature-flags`)
    state.flags = data.flags ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function setEnabled(key, enabled) {
  const { flag } = await apiJson(`${API.admin.url}/feature-flags/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body:   JSON.stringify({ enabled }),
  })
  const i = state.flags.findIndex(f => f.key === key)
  if (i >= 0) state.flags[i] = flag
}

export function useAdminFeatureFlags() {
  return { state, fetchAll, setEnabled }
}
