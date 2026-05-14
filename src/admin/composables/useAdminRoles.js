import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  roles:       [],
  permissions: [],
  loading:     false,
  error:       null,
})

async function fetchAll() {
  state.loading = true
  state.error   = null
  try {
    const [rolesData, permsData] = await Promise.all([
      apiJson(`${API.admin.url}/roles`),
      apiJson(`${API.admin.url}/roles/permissions`),
    ])
    state.roles       = rolesData.roles ?? []
    state.permissions = permsData.permissions ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function create({ id, name, description, permissions }) {
  const created = await apiJson(`${API.admin.url}/roles`, {
    method: 'POST',
    body:   JSON.stringify({ id, name, description, permissions }),
  })
  state.roles.push({ ...created, system: false })
  return created
}

async function update(id, patch) {
  await apiJson(`${API.admin.url}/roles/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  })
  const idx = state.roles.findIndex(r => r.id === id)
  if (idx >= 0) state.roles[idx] = { ...state.roles[idx], ...patch }
}

async function remove(id) {
  await apiJson(`${API.admin.url}/roles/${id}`, { method: 'DELETE' })
  state.roles = state.roles.filter(r => r.id !== id)
}

export function useAdminRoles() {
  return { state, fetchAll, create, update, remove }
}
