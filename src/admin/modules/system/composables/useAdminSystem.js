import { reactive } from 'vue'
import { apiJson, apiFetch } from '@/composables/auth/apiClient.js'
import { API } from '@/config/api.js'

const state = reactive({
  stats:    null,
  backups:  [],
  loading:  false,
  error:    null,
})

async function fetchStats() {
  state.loading = true
  state.error   = null
  try {
    state.stats = await apiJson(`${API.admin.url}/system`)
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function fetchBackups() {
  const data = await apiJson(`${API.admin.url}/system/backups`)
  state.backups = data.backups ?? []
}

async function createBackup() {
  const result = await apiJson(`${API.admin.url}/system/backups`, { method: 'POST' })
  await fetchBackups()
  return result
}

async function deleteBackup(name) {
  await apiJson(`${API.admin.url}/system/backups/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    body:   JSON.stringify({ confirm: name }),
  })
  state.backups = state.backups.filter(b => b.file !== name)
}

async function downloadBackup(name) {
  const res = await apiFetch(`${API.admin.url}/system/backups/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function triggerBuild() {
  return apiJson(`${API.admin.url}/system/build`, { method: 'POST' })
}

export function useAdminSystem() {
  return { state, fetchStats, fetchBackups, createBackup, deleteBackup, downloadBackup, triggerBuild }
}
