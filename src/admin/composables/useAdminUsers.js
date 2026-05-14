import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  users:   [],
  loading: false,
  error:   null,
})

async function fetchAll() {
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/users`)
    state.users = data.users ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function setRoles(userId, roles) {
  await apiJson(`${API.admin.url}/users/${userId}/roles`, {
    method: 'PUT',
    body:   JSON.stringify({ roles }),
  })
  const idx = state.users.findIndex(u => u.id === userId)
  if (idx >= 0) state.users[idx] = { ...state.users[idx], roles }
}

async function suspend(userId) {
  await apiJson(`${API.admin.url}/users/${userId}/suspend`, { method: 'POST' })
  const idx = state.users.findIndex(u => u.id === userId)
  if (idx >= 0) state.users[idx] = { ...state.users[idx], suspendedAt: new Date().toISOString() }
}

async function unsuspend(userId) {
  await apiJson(`${API.admin.url}/users/${userId}/unsuspend`, { method: 'POST' })
  const idx = state.users.findIndex(u => u.id === userId)
  if (idx >= 0) state.users[idx] = { ...state.users[idx], suspendedAt: null }
}

export function useAdminUsers() {
  return { state, fetchAll, setRoles, suspend, unsuspend }
}
