import { useAuth, whenAuthHydrated } from './useAuth.js'
import { reportFailure, reportSuccess } from '@/composables/useBackendStatus.js'

/**
 * Fetch with Bearer token, automatic refresh + retry on 401, and state
 * clear on final 401. Works in both sidebar and service-worker context.
 *
 * Also feeds the global backend-status tracker: network-level failures
 * (TypeError: Failed to fetch) flip the app to "offline" and trigger the
 * retry loop; any successful HTTP response flips back to "online".
 */
export async function apiFetch(url, options = {}) {
  await whenAuthHydrated()
  const auth = useAuth()

  async function doFetch(token) {
    const headers = new Headers(options.headers ?? {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(url, { ...options, headers })
  }

  let res
  try {
    res = await doFetch(auth.state.accessToken)
  } catch (e) {
    reportFailure(e)
    throw e
  }

  if (res.status === 401 && auth.state.refreshToken) {
    const newToken = await auth.refresh()
    if (newToken) {
      try {
        res = await doFetch(newToken)
      } catch (e) {
        reportFailure(e)
        throw e
      }
    }
  }

  // Got *some* response — server is alive, even if it didn't like this
  // specific call. Flip back to online if we were marked offline.
  reportSuccess()

  if (res.status === 401) auth.clear()

  return res
}

/**
 * JSON convenience — throws on !ok with a human-friendly message. Priority:
 *   1. server's `message` field
 *   2. flattened Zod-issues from `defineRoute()`'s `invalid_body` / `invalid_query`
 *   3. `error` field
 *   4. plain HTTP status fallback
 *
 * The full `data` payload is attached as `err.data` for callers that want
 * structured access.
 */
export async function apiJson(url, options = {}) {
  const res  = await apiFetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let message = data.message
    if (!message && Array.isArray(data.issues) && data.issues.length) {
      message = data.issues
        .map(i => i.path?.length ? `${i.path.join('.')}: ${i.message}` : i.message)
        .filter(Boolean).join('; ')
    }
    if (!message && data.error) message = data.error
    if (!message)               message = `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data   = data
    throw err
  }
  return data
}
