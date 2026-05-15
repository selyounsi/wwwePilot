import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  query:   '',
  loading: false,
  results: { users: [], reports: [], sites: [], runs: [] },
})

let inflight = 0

/**
 * Cross-entity admin search. The backend caps results per category so a
 * single chatty user search can't drown the bell-tower of report hits.
 * Inflight tracking avoids out-of-order races when the user types fast:
 * each call gets a sequence id, only the most recent one writes back.
 */
async function search(q) {
  state.query = q
  const trimmed = (q ?? '').trim()
  if (trimmed.length < 2) {
    state.results = { users: [], reports: [], sites: [], runs: [] }
    state.loading = false
    return
  }

  const seq = ++inflight
  state.loading = true
  try {
    const data = await apiJson(`${API.admin.url}/search?q=${encodeURIComponent(trimmed)}`)
    if (seq === inflight) state.results = data
  } catch (e) {
    if (seq === inflight) state.results = { users: [], reports: [], sites: [], runs: [] }
  } finally {
    if (seq === inflight) state.loading = false
  }
}

export function useAdminSearch() {
  return { state, search }
}
