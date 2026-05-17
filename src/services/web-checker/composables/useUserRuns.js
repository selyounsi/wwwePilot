import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

/**
 * "Vorherige Checks" — the employee's own check-run history. Distinct from
 * the admin /admin/runs surface: this one only ever returns the caller's
 * own rows and is allowed to delete them.
 */

const state = reactive({
  origins:        [],     // [{ origin, run_count, total_errors, last_run }]
  runs:           [],     // runs for the currently-loaded origin (or all)
  detail:         null,   // { run, modules } for the open detail view
  loadingOrigins: false,
  loadingRuns:    false,
  loadingDetail:  false,
  busy:           false,
  error:          null,
})

const BASE = `${API.runs.url}`

async function fetchOrigins() {
  state.loadingOrigins = true
  state.error = null
  try {
    const data = await apiJson(`${BASE}/mine/origins`)
    state.origins = data.origins ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loadingOrigins = false
  }
}

async function fetchRuns({ origin, limit = 50, status } = {}) {
  state.loadingRuns = true
  state.error = null
  try {
    const p = new URLSearchParams()
    if (origin) p.set('origin', origin)
    if (limit)  p.set('limit',  String(limit))
    if (status) p.set('status', status)
    const data = await apiJson(`${BASE}/mine?${p.toString()}`)
    state.runs = data.runs ?? []
  } catch (e) {
    state.error = e.message
    state.runs = []
  } finally {
    state.loadingRuns = false
  }
}

async function fetchDetail(id) {
  state.loadingDetail = true
  state.detail = null
  state.error = null
  try {
    state.detail = await apiJson(`${BASE}/${encodeURIComponent(id)}`)
    return state.detail
  } catch (e) {
    state.error = e.message
    return null
  } finally {
    state.loadingDetail = false
  }
}

async function deleteRun(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    state.runs = state.runs.filter(r => r.id !== id)
    // Don't try to mutate `state.origins` locally — the run_count aggregate
    // can't be reliably patched without a re-fetch. The view calls
    // `fetchOrigins()` when the user navigates back to the origins screen.
    if (state.detail?.run?.id === id) state.detail = null
  } finally {
    state.busy = false
  }
}

export function useUserRuns() {
  return { state, fetchOrigins, fetchRuns, fetchDetail, deleteRun }
}
