import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const state = reactive({
  selectors: [],
  scopes:    [],
  loading:   false,
  error:     null,
})

async function fetchAll(scope) {
  state.loading = true
  state.error   = null
  try {
    const q = scope ? `?scope=${encodeURIComponent(scope)}` : ''
    const [list, scopes] = await Promise.all([
      apiJson(`${API.admin.url}/selectors${q}`),
      apiJson(`${API.admin.url}/selectors/scopes`),
    ])
    state.selectors = list.selectors ?? []
    state.scopes    = scopes.scopes  ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function create({ scope, pattern, note }) {
  const { selector } = await apiJson(`${API.admin.url}/selectors`, {
    method: 'POST',
    body:   JSON.stringify({ scope, pattern, note }),
  })
  state.selectors.push(selector)
  return selector
}

async function update(id, patch) {
  const { selector } = await apiJson(`${API.admin.url}/selectors/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  })
  const i = state.selectors.findIndex(s => s.id === id)
  if (i >= 0) state.selectors[i] = selector
}

async function remove(id) {
  await apiJson(`${API.admin.url}/selectors/${id}`, { method: 'DELETE' })
  state.selectors = state.selectors.filter(s => s.id !== id)
}

async function resetScope(scope) {
  const result = await apiJson(`${API.admin.url}/selectors/reset/${scope}`, { method: 'POST' })
  await fetchAll()
  return result
}

export function useAdminSelectors() {
  return { state, fetchAll, create, update, remove, resetScope }
}
