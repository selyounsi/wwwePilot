import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/groups`

/**
 * Admin composable for groups CRUD + member management. Single shared
 * reactive store so the list view, detail view and the check-type
 * picker can all observe the same data without re-fetch ping-pong.
 */
const state = reactive({
  groups:   [],
  current:  null,         // { group, members }  | null
  loading:  false,
  busy:     false,
  error:    null,
})

async function fetchAll() {
  state.loading = true
  state.error = null
  try {
    const data = await apiJson(BASE)
    state.groups = data.groups ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function fetchOne(id) {
  state.busy = true
  try {
    const data = await apiJson(`${BASE}/${encodeURIComponent(id)}`)
    state.current = data
    return data
  } finally {
    state.busy = false
  }
}

async function create(payload) {
  state.busy = true
  try {
    const { group } = await apiJson(BASE, { method: 'POST', body: JSON.stringify(payload) })
    await fetchAll()
    return group
  } finally {
    state.busy = false
  }
}

async function update(id, patch) {
  state.busy = true
  try {
    const { group } = await apiJson(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchAll()
    if (state.current?.group?.id === id) state.current.group = group
    return group
  } finally {
    state.busy = false
  }
}

async function remove(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await fetchAll()
    if (state.current?.group?.id === id) state.current = null
  } finally {
    state.busy = false
  }
}

async function setMembers(id, userIds) {
  state.busy = true
  try {
    await apiJson(`${BASE}/${encodeURIComponent(id)}/members`, { method: 'PUT', body: JSON.stringify({ userIds }) })
    await fetchOne(id)
    await fetchAll()
  } finally {
    state.busy = false
  }
}

export function useAdminGroups() {
  return { state, fetchAll, fetchOne, create, update, remove, setMembers }
}
