import { reactive } from 'vue'
import { API } from '@/config/api.js'

/**
 * Global "is the backend reachable?" state.
 *
 * Flow:
 *   - apiFetch / standalone fetches call reportFailure(err) on network
 *     errors and reportSuccess() on any received response.
 *   - reportFailure does NOT flip offline on a single failure — that
 *     could be a transient race (CORS preflight while the backend just
 *     started, an aborted navigation). It triggers a dedicated probe
 *     against /api/version. The probe is the authoritative signal:
 *     probe fails ⇒ offline, probe ok ⇒ stay online.
 *   - Once offline, a 5s retry loop keeps probing until the server
 *     comes back. Any successful response flips us back to online.
 */

const RETRY_INTERVAL_MS = 5_000

const state = reactive({
  online:    true,
  lastError: null,
  lastCheck: null,
  retrying:  false,
})

let retryTimer = null
let probeInFlight = null

function isNetworkError(err) {
  if (!err) return false
  if (err.name === 'TypeError')  return true
  if (err.name === 'AbortError') return true
  return false
}

function startRetryLoop() {
  if (retryTimer) return
  retryTimer = setInterval(probe, RETRY_INTERVAL_MS)
}

function stopRetryLoop() {
  if (retryTimer) clearInterval(retryTimer)
  retryTimer = null
}

/**
 * Authoritative reachability check. Fires against /api/version which is
 * public + light. Any successful response (even non-2xx) counts —
 * the server is talking. Coalesces concurrent calls.
 */
export async function probe() {
  if (probeInFlight) return probeInFlight
  state.retrying = true
  probeInFlight = (async () => {
    try {
      await fetch(`${API.version.url}`, { credentials: 'omit', cache: 'no-store' })
      state.lastCheck = Date.now()
      state.lastError = null
      if (!state.online) {
        state.online = true
        stopRetryLoop()
      }
    } catch (e) {
      state.lastError = e?.message ?? 'network'
      state.lastCheck = Date.now()
      if (state.online) {
        state.online = false
        startRetryLoop()
      }
    } finally {
      state.retrying = false
      probeInFlight = null
    }
  })()
  return probeInFlight
}

/**
 * A real fetch saw a network-level error. We don't trust a single failure
 * — schedule a probe to confirm. Probe result decides whether the banner
 * appears.
 */
export function reportFailure(err) {
  if (!isNetworkError(err)) return
  state.lastError = err?.message ?? 'network'
  state.lastCheck = Date.now()
  probe()
}

/** A real fetch got *some* response. Server is reachable. */
export function reportSuccess() {
  state.lastCheck = Date.now()
  if (!state.online) {
    state.online = true
    state.lastError = null
    stopRetryLoop()
  }
}

export function useBackendStatus() {
  return { state, probe, reportFailure, reportSuccess }
}
