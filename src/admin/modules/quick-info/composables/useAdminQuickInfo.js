import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/quick-info`

const state = reactive({
  profiles: [],
  current:  null,    // { profile, sections: [{ ...section, rules: [] }] }
  loading:  false,
  busy:     false,
  error:    null,
})

async function fetchAll() {
  state.loading = true
  state.error = null
  try {
    const data = await apiJson(`${BASE}/profiles`)
    state.profiles = data.profiles ?? []
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
    const data = await apiJson(`${BASE}/profiles/${id}`)
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
    const { profile } = await apiJson(`${BASE}/profiles`, { method: 'POST', body: JSON.stringify(payload) })
    await fetchAll()
    return profile
  } finally { state.busy = false }
}

async function update(id, patch) {
  state.busy = true
  try {
    const { profile } = await apiJson(`${BASE}/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchAll()
    if (state.current?.profile?.id === id) state.current.profile = profile
    return profile
  } finally { state.busy = false }
}

async function remove(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/profiles/${id}`, { method: 'DELETE' })
    await fetchAll()
    if (state.current?.profile?.id === id) state.current = null
  } finally { state.busy = false }
}

async function addSection(profileId, payload) {
  state.busy = true
  try {
    const { section } = await apiJson(`${BASE}/profiles/${profileId}/sections`, { method: 'POST', body: JSON.stringify(payload) })
    await fetchOne(profileId)
    return section
  } finally { state.busy = false }
}

async function updateSection(profileId, sectionId, patch) {
  state.busy = true
  try {
    const { section } = await apiJson(`${BASE}/sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchOne(profileId)
    return section
  } finally { state.busy = false }
}

async function removeSection(profileId, sectionId) {
  state.busy = true
  try {
    await apiJson(`${BASE}/sections/${sectionId}`, { method: 'DELETE' })
    await fetchOne(profileId)
  } finally { state.busy = false }
}

async function addRule(profileId, sectionId, payload) {
  state.busy = true
  try {
    const { rule } = await apiJson(`${BASE}/sections/${sectionId}/rules`, { method: 'POST', body: JSON.stringify(payload) })
    await fetchOne(profileId)
    return rule
  } finally { state.busy = false }
}

async function updateRule(profileId, ruleId, patch) {
  state.busy = true
  try {
    const { rule } = await apiJson(`${BASE}/rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await fetchOne(profileId)
    return rule
  } finally { state.busy = false }
}

async function removeRule(profileId, ruleId) {
  state.busy = true
  try {
    await apiJson(`${BASE}/rules/${ruleId}`, { method: 'DELETE' })
    await fetchOne(profileId)
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
      body:   JSON.stringify({ mode, profiles: payload.profiles ?? [] }),
    })
    await fetchAll()
    return result
  } finally { state.busy = false }
}

export function useAdminQuickInfo() {
  return {
    state,
    fetchAll, fetchOne,
    create, update, remove,
    addSection, updateSection, removeSection,
    addRule, updateRule, removeRule,
    exportAll, importAll,
  }
}
