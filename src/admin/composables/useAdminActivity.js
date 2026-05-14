import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  events:  [],
  hasMore: false,
  counts:  [],
  days:    30,
  loading: false,
  error:   null,
})

function buildQuery(filters = {}) {
  const p = new URLSearchParams()
  if (filters.user)   p.set('user',   filters.user)
  if (filters.type)   p.set('type',   filters.type)
  if (filters.since)  p.set('since',  filters.since)
  if (filters.before) p.set('before', filters.before)
  if (filters.limit)  p.set('limit',  String(filters.limit))
  const q = p.toString()
  return q ? `?${q}` : ''
}

async function fetchEvents(filters = {}) {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/activity${buildQuery(filters)}`)
    state.events  = data.events  ?? []
    state.hasMore = data.hasMore ?? false
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function loadMore(filters = {}) {
  if (!state.hasMore || !state.events.length) return
  const before = state.events[state.events.length - 1].createdAt
  try {
    const data = await apiJson(`${API.admin.url}/activity${buildQuery({ ...filters, before })}`)
    state.events  = [...state.events, ...(data.events ?? [])]
    state.hasMore = data.hasMore ?? false
  } catch (e) {
    state.error = e.message
  }
}

async function fetchCounts(days = 30) {
  try {
    const data = await apiJson(`${API.admin.url}/activity/counts?days=${days}`)
    state.counts = data.counts ?? []
    state.days   = data.days   ?? days
  } catch (e) {
    state.error = e.message
  }
}

export function useAdminActivity() {
  return { state, fetchEvents, loadMore, fetchCounts }
}
