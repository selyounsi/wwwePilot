import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/check-types`

/**
 * Composable for the admin check-types module. Exposes a single shared
 * reactive store (Pinia would be overkill for one screen) plus async
 * CRUD helpers. Each mutation refreshes the list so the UI stays
 * consistent without manual cache invalidation.
 */
const state = reactive({
  types:    [],      // CheckType[]
  current:  null,    // { type, tasks } for the detail view
  loading:  false,
  busy:     false,
  error:    null,
})

async function fetchAll() {
  state.loading = true
  state.error = null
  try {
    const data = await apiJson(BASE)
    state.types = data.types ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function fetchOne(id) {
  state.busy = true
  state.error = null
  try {
    const data = await apiJson(`${BASE}/${id}`)
    state.current = data
    return data
  } catch (e) {
    state.error = e.message
    throw e
  } finally {
    state.busy = false
  }
}

async function create(payload) {
  state.busy = true
  try {
    const { type } = await apiJson(BASE, { method: 'POST', body: JSON.stringify(payload) })
    await fetchAll()
    return type
  } finally {
    state.busy = false
  }
}

async function update(id, patch) {
  state.busy = true
  try {
    const { type } = await apiJson(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchAll()
    if (state.current?.type?.id === id) state.current.type = type
    return type
  } finally {
    state.busy = false
  }
}

async function remove(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/${id}`, { method: 'DELETE' })
    await fetchAll()
    if (state.current?.type?.id === id) state.current = null
  } finally {
    state.busy = false
  }
}

async function addTask(typeId, payload) {
  state.busy = true
  try {
    const { task } = await apiJson(`${BASE}/${typeId}/tasks`, { method: 'POST', body: JSON.stringify(payload) })
    await fetchOne(typeId)
    return task
  } finally {
    state.busy = false
  }
}

async function updateTask(typeId, taskId, patch) {
  state.busy = true
  try {
    const { task } = await apiJson(`${BASE}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchOne(typeId)
    return task
  } finally {
    state.busy = false
  }
}

async function removeTask(typeId, taskId) {
  state.busy = true
  try {
    await apiJson(`${BASE}/tasks/${taskId}`, { method: 'DELETE' })
    await fetchOne(typeId)
  } finally {
    state.busy = false
  }
}

async function reorderTasks(typeId, ids) {
  await apiJson(`${BASE}/${typeId}/tasks/reorder`, { method: 'POST', body: JSON.stringify({ ids }) })
  await fetchOne(typeId)
}

export function useAdminCheckTypes() {
  return {
    state,
    fetchAll, fetchOne,
    create, update, remove,
    addTask, updateTask, removeTask, reorderTasks,
  }
}
