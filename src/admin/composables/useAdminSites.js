import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  sites:   [],
  loading: false,
  error:   null,
})

const detailState = reactive({
  loading: false,
  error:   null,
  detail:  null,
})

async function fetchAll(days = 30) {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/sites?days=${days}`)
    state.sites = data.sites ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function fetchDetail(origin) {
  detailState.loading = true
  detailState.error   = null
  detailState.detail  = null
  try {
    detailState.detail = await apiJson(`${API.admin.url}/sites/${encodeURIComponent(origin)}`)
  } catch (e) {
    detailState.error = e.message
  } finally {
    detailState.loading = false
  }
}

export function useAdminSites() {
  return { state, detailState, fetchAll, fetchDetail }
}
