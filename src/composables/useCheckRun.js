import { reactive } from 'vue'
import { apiFetch } from './auth/apiClient.js'
import { useAuth }  from './auth/useAuth.js'
import { API }      from '@/config/api.js'

const state = reactive({
  currentRun: null,   // { id, kind, origin, startedAt }
})

function newRunId() {
  return crypto.randomUUID()
}

/**
 * Begin a check run server-side and stash the id in module-local state so
 * subsequent recordModule + finish calls can target it. Fire-and-forget;
 * a failed start doesn't prevent the local check from running.
 */
async function start({ kind, origin, pagesCount = 1 }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) return null

  const id = newRunId()
  state.currentRun = { id, kind, origin, startedAt: Date.now() }

  apiFetch(`${API.runs.url}/start`, {
    method: 'POST',
    body:   JSON.stringify({ id, kind, origin, pagesCount }),
  }).catch(e => console.warn('[run] start failed:', e.message))

  return id
}

function recordModule({ moduleId, errorCount, warningCount, durationMs }) {
  const run = state.currentRun
  if (!run) return
  apiFetch(`${API.runs.url}/${run.id}/module`, {
    method: 'POST',
    body:   JSON.stringify({ moduleId, errorCount, warningCount, durationMs }),
  }).catch(e => console.warn('[run] recordModule failed:', e.message))
}

function finish() {
  const run = state.currentRun
  if (!run) return
  apiFetch(`${API.runs.url}/${run.id}/finish`, { method: 'POST' })
    .catch(e => console.warn('[run] finish failed:', e.message))
  state.currentRun = null
}

export function useCheckRun() {
  return { state, start, recordModule, finish }
}
