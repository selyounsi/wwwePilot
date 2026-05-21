import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/quick-links`

const state = reactive({
  links:   [],
  current: null,
  loading: false,
  busy:    false,
  error:   null,
})

async function fetchAll() {
  state.loading = true
  state.error = null
  try {
    const data = await apiJson(`${BASE}/`)
    state.links = data.links ?? []
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
    const { link } = await apiJson(`${BASE}/${id}`)
    state.current = link
    return link
  } catch (e) {
    state.error = e.message
    throw e
  } finally { state.busy = false }
}

async function create(payload) {
  state.busy = true
  try {
    const { link } = await apiJson(`${BASE}/`, { method: 'POST', body: JSON.stringify(payload) })
    await fetchAll()
    return link
  } finally { state.busy = false }
}

async function update(id, patch) {
  state.busy = true
  try {
    const { link } = await apiJson(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchAll()
    if (state.current?.id === id) state.current = link
    return link
  } finally { state.busy = false }
}

async function remove(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/${id}`, { method: 'DELETE' })
    await fetchAll()
    if (state.current?.id === id) state.current = null
  } finally { state.busy = false }
}

async function reorder(ids) {
  state.busy = true
  try {
    await apiJson(`${BASE}/reorder`, { method: 'POST', body: JSON.stringify({ ids }) })
    await fetchAll()
  } finally { state.busy = false }
}

async function exportAll() {
  return apiJson(`${BASE}/export`)
}

async function importAll(payload, mode = 'merge') {
  state.busy = true
  try {
    const result = await apiJson(`${BASE}/import`, {
      method: 'POST',
      body:   JSON.stringify({ mode, links: payload.links ?? [] }),
    })
    await fetchAll()
    return result
  } finally { state.busy = false }
}

export function useAdminQuickLinks() {
  return { state, fetchAll, fetchOne, create, update, remove, reorder, exportAll, importAll }
}
