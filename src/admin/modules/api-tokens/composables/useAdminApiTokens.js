import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/api-tokens`

const state = reactive({
  tokens:  [],
  loading: false,
  busy:    false,
  error:   null,
  /** Raw token returned by the last create call — shown ONCE, then cleared. */
  freshToken: null,
})

async function fetchAll() {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(BASE)
    state.tokens = data.tokens ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function create({ name, permissions, expiresAt }) {
  state.busy = true
  try {
    const r = await apiJson(BASE, {
      method: 'POST',
      body:   JSON.stringify({ name, permissions, expiresAt: expiresAt || undefined }),
    })
    state.freshToken = r.token
    state.tokens.unshift(r.record)
    return r
  } finally {
    state.busy = false
  }
}

async function revoke(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const i = state.tokens.findIndex(t => t.id === id)
    if (i >= 0) state.tokens[i] = { ...state.tokens[i], status: 'revoked', revokedAt: new Date().toISOString() }
  } finally {
    state.busy = false
  }
}

function clearFreshToken() {
  state.freshToken = null
}

export function useAdminApiTokens() {
  return { state, fetchAll, create, revoke, clearFreshToken }
}
