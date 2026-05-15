import { reactive } from 'vue'
import { apiJson } from './auth/apiClient.js'
import { useAuth } from './auth/useAuth.js'
import { API }     from '@/config/api.js'

const state = reactive({
  mine:    [],
  loading: false,
  error:   null,
})

// Singleton dialog state — anything in the app can call open() to surface
// the report dialog with a prefilled scope. Mounted once in App.vue.
const dialog = reactive({
  open:    false,
  prefill: null,    // { scope, moduleId?, origin?, scopePath?, issueHash?, title? }
})

function openDialog(prefill = { scope: 'app' }) {
  dialog.prefill = prefill
  dialog.open    = true
}

function closeDialog() {
  dialog.open    = false
  dialog.prefill = null
}

async function fetchMine() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) return
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.reports.url}/mine`)
    state.mine = data.reports ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loading = false
  }
}

async function submit(payload) {
  const enriched = {
    ...payload,
    userAgent:        navigator.userAgent,
    extensionVersion: chrome.runtime.getManifest?.()?.version ?? null,
  }
  const { report } = await apiJson(`${API.reports.url}`, {
    method: 'POST',
    body:   JSON.stringify(enriched),
  })
  state.mine = [report, ...state.mine]
  return report
}

async function fetchDetail(id) {
  return apiJson(`${API.reports.url}/${id}`)
}

async function comment(reportId, content) {
  return apiJson(`${API.reports.url}/${reportId}/comments`, {
    method: 'POST',
    body:   JSON.stringify({ content }),
  })
}

export function useReports() {
  return { state, dialog, openDialog, closeDialog, fetchMine, submit, fetchDetail, comment }
}
