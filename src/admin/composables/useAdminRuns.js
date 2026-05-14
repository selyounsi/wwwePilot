import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  runs:    [],
  hasMore: false,
  loading: false,
  error:   null,
})

function buildQuery(filters = {}) {
  const p = new URLSearchParams()
  if (filters.user)   p.set('user',   filters.user)
  if (filters.origin) p.set('origin', filters.origin)
  if (filters.kind)   p.set('kind',   filters.kind)
  if (filters.before) p.set('before', filters.before)
  if (filters.limit)  p.set('limit',  String(filters.limit))
  const q = p.toString()
  return q ? `?${q}` : ''
}

async function fetchAll(filters = {}) {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/runs${buildQuery(filters)}`)
    state.runs    = data.runs    ?? []
    state.hasMore = data.hasMore ?? false
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function loadMore(filters = {}) {
  if (!state.hasMore || !state.runs.length) return
  const before = state.runs[state.runs.length - 1].started_at
  const data = await apiJson(`${API.admin.url}/runs${buildQuery({ ...filters, before })}`)
  state.runs    = [...state.runs, ...(data.runs ?? [])]
  state.hasMore = data.hasMore ?? false
}

async function fetchDetail(id) {
  return apiJson(`${API.admin.url}/runs/${id}`)
}

async function remove(id) {
  await apiJson(`${API.admin.url}/runs/${id}`, {
    method: 'DELETE',
    body:   JSON.stringify({ confirm: id }),
  })
  state.runs = state.runs.filter(r => r.id !== id)
}

export function useAdminRuns() {
  return { state, fetchAll, loadMore, fetchDetail, remove }
}
