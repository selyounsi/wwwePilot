import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  reports: [],
  counts:  { open: 0, investigating: 0, resolved: 0, wont_fix: 0 },
  stats:   null,
  loading: false,
  error:   null,
})

function buildQuery(filters = {}) {
  const p = new URLSearchParams()
  if (filters.status)   p.set('status',   filters.status)
  if (filters.scope)    p.set('scope',    filters.scope)
  if (filters.category) p.set('category', filters.category)
  if (filters.module)   p.set('module',   filters.module)
  if (filters.user)     p.set('user',     filters.user)
  if (filters.limit)    p.set('limit',    String(filters.limit))
  const q = p.toString()
  return q ? `?${q}` : ''
}

async function fetchAll(filters = {}) {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/reports${buildQuery(filters)}`)
    state.reports = data.reports ?? []
    state.counts  = data.counts  ?? state.counts
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

/**
 * Cheap counts-only fetch. Used by the sidebar polling + the dashboard KPI
 * tile so they can show "X open" without paying for the full report list.
 */
async function fetchCounts() {
  try {
    const counts = await apiJson(`${API.admin.url}/reports/counts`)
    state.counts = counts
    return counts
  } catch (e) {
    // Silent — sidebar badge degrades to "no badge" rather than surfacing
    // an error toast on every poll.
    return null
  }
}

/**
 * Aggregate stats panel data — categories, scopes, top reporters, resolution
 * time, 14-day inflow. Single round-trip on demand (lazy: only when panel
 * gets opened, not polled).
 */
async function fetchStats() {
  try {
    const stats = await apiJson(`${API.admin.url}/reports/stats`)
    state.stats = stats
    return stats
  } catch (e) {
    state.error = e.message
    return null
  }
}

async function fetchDetail(id) {
  return apiJson(`${API.reports.url}/${id}`)
}

async function assign(id, assignedTo) {
  return update(id, { assignedTo: assignedTo || null })
}

async function update(id, patch) {
  const { report } = await apiJson(`${API.admin.url}/reports/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  })
  const i = state.reports.findIndex(r => r.id === id)
  if (i >= 0) state.reports[i] = report
  return report
}

async function remove(id) {
  await apiJson(`${API.admin.url}/reports/${id}`, {
    method: 'DELETE',
    body:   JSON.stringify({ confirm: id }),
  })
  state.reports = state.reports.filter(r => r.id !== id)
}

async function comment(reportId, content) {
  return apiJson(`${API.reports.url}/${reportId}/comments`, {
    method: 'POST',
    body:   JSON.stringify({ content }),
  })
}

export function useAdminReports() {
  return { state, fetchAll, fetchCounts, fetchStats, fetchDetail, update, assign, remove, comment }
}
