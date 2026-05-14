import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  kpi:       null,
  trend:     [],
  trendDays: 30,
  sites:     [],
  modules:   [],
  topUsers:  [],
  loading:   false,
  error:     null,
})

async function fetchAll() {
  state.loading = true
  state.error   = null
  try {
    const [kpi, trend, sites, modules, topUsers] = await Promise.all([
      apiJson(`${API.admin.url}/dashboard`),
      apiJson(`${API.admin.url}/dashboard/trend?days=${state.trendDays}`),
      apiJson(`${API.admin.url}/dashboard/sites?limit=10`),
      apiJson(`${API.admin.url}/dashboard/modules`),
      apiJson(`${API.admin.url}/dashboard/top-users?limit=10`).catch(() => ({ users: [] })),
    ])
    state.kpi      = kpi
    state.trend    = trend.points ?? []
    state.sites    = sites.sites ?? []
    state.modules  = modules.modules ?? []
    state.topUsers = topUsers.users ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function refresh() {
  state.loading = true
  try {
    await apiJson(`${API.admin.url}/dashboard/refresh`, { method: 'POST' })
    await fetchAll()
  } catch (e) {
    state.error = e.message
    state.loading = false
  }
}

function setTrendDays(days) {
  state.trendDays = days
  return fetchAll()
}

export function useAdminDashboard() {
  return { state, fetchAll, refresh, setTrendDays }
}
