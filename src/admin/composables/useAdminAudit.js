import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  events:  [],
  loading: false,
  error:   null,
})

async function fetchAll({ limit = 100, before = null } = {}) {
  state.loading = true
  state.error   = null
  try {
    const p = new URLSearchParams({ limit: String(limit) })
    if (before) p.set('before', before)
    const data = await apiJson(`${API.admin.url}/audit?${p}`)
    state.events = data.events ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

export function useAdminAudit() {
  return { state, fetchAll }
}
