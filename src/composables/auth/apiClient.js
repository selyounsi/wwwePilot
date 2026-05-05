import { useAuth, whenAuthHydrated } from './useAuth.js'

/**
 * Fetch with Bearer token, automatic refresh + retry on 401, and state clear
 * on final 401. Works in both sidebar and service-worker context.
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

  let res = await doFetch(auth.state.accessToken)

  if (res.status === 401 && auth.state.refreshToken) {
    const newToken = await auth.refresh()
    if (newToken) res = await doFetch(newToken)
  }

  if (res.status === 401) auth.clear()

  return res
}

/** JSON convenience — throws on !ok with the `message` field from the response. */
export async function apiJson(url, options = {}) {
  const res  = await apiFetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message ?? `HTTP ${res.status}`)
    err.status = res.status
    err.data   = data
    throw err
  }
  return data
}
