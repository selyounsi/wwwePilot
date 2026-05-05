import { reactive, computed } from 'vue'
import { createSettingsStore } from '../settings/createSettingsStore.js'
import { API } from '@/config/api.js'

const STORAGE_KEY = 'wp-auth'

const state = reactive({
  accessToken:  null,
  refreshToken: null,
  user:         null,
})

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  onHydrate(stored, state) {
    if (!stored || typeof stored !== 'object') return
    state.accessToken  = stored.accessToken  ?? null
    state.refreshToken = stored.refreshToken ?? null
    state.user         = stored.user         ?? null
  },
  onSerialize(state) {
    return {
      accessToken:  state.accessToken,
      refreshToken: state.refreshToken,
      user:         state.user,
    }
  },
})

let refreshInFlight = null

const PROVIDER_COOKIE_DOMAINS = [
  'auth.everapps.dev',
  'login-test.viscomp.net',
]

/** Workaround for EverAuth's 500 on reused sessions. */
async function clearProviderCookies() {
  if (!chrome.cookies?.getAll) return
  for (const domain of PROVIDER_COOKIE_DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain })
      await Promise.all(cookies.map(c => {
        const host   = c.domain.replace(/^\./, '')
        const scheme = c.secure ? 'https' : 'http'
        const url    = `${scheme}://${host}${c.path}`
        return chrome.cookies.remove({ url, name: c.name }).catch(() => {})
      }))
    } catch {}
  }
}

function clear() {
  state.accessToken  = null
  state.refreshToken = null
  state.user         = null
}

/** Opens the OIDC flow in the auth window and persists the app JWTs. */
async function login() {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new Error('chrome.identity API not available — extension only')
  }

  await clearProviderCookies()

  const extRedirect = chrome.identity.getRedirectURL()
  const authUrl     = `${API.auth.url}/login?ext_redirect=${encodeURIComponent(extRedirect)}`

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError)   reject(new Error(chrome.runtime.lastError.message))
        else if (!responseUrl)          reject(new Error('Login cancelled'))
        else                            resolve(responseUrl)
      },
    )
  })

  const params = new URL(responseUrl).searchParams
  const error  = params.get('error')
  if (error) throw new Error(error)

  const accessToken  = params.get('accessToken')
  const refreshToken = params.get('refreshToken')
  const userJson     = params.get('user')
  if (!accessToken || !refreshToken) throw new Error('Missing tokens in callback')

  state.accessToken  = accessToken
  state.refreshToken = refreshToken
  state.user         = userJson ? JSON.parse(userJson) : null
  return state.user
}

async function logout() {
  const token = state.refreshToken
  clear()
  if (!token) return
  try {
    await fetch(`${API.auth.url}/logout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken: token }),
    })
  } catch {}
}

/**
 * Single-flight refresh — prevents parallel 401s from racing competing
 * refresh-token rotations at the backend.
 */
async function refresh() {
  if (refreshInFlight) return refreshInFlight
  if (!state.refreshToken) return null

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API.auth.url}/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: state.refreshToken }),
      })
      if (!res.ok) {
        clear()
        return null
      }
      const data = await res.json()
      state.accessToken  = data.accessToken
      state.refreshToken = data.refreshToken
      state.user         = data.user
      return data.accessToken
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

const isAuthenticated = computed(() => !!state.accessToken)

/** Resolves once the persisted auth state has been loaded from chrome.storage.local. */
export function whenAuthHydrated() {
  return hydrationPromise
}

/** Reactive auth API. Tokens persist under `wp-auth`. */
export function useAuth() {
  return { state, isAuthenticated, login, logout, refresh, clear }
}

/** Sync getter for service-worker and page context. */
export function getCurrentAccessToken() {
  return state.accessToken
}
