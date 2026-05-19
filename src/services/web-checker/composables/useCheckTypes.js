import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'
import { useFeatureFlags } from '@/composables/useFeatureFlags.js'

const BASE = API.checkTypes.url

/**
 * Web-checker side of the check-types feature. Talks to `/api/check-types/*`
 * (the user-facing routes, not the admin ones), filtered server-side by
 * the caller's roles.
 *
 *  - `state.available` = the dropdown contents (no tasks attached)
 *  - `state.active`    = currently-selected type + its task list
 *  - `state.states`    = per-URL task states (joined with active.tasks at view time)
 *
 * Feature-flag gated. If `webchecker.check_types` is off OR no types are
 * defined, `available` stays empty and the UI hides the selector.
 */

const state = reactive({
  available:   [],          // [{ id, name, slug, description, moduleIds, taskCount }]
  active:      null,        // { type, tasks }  | null
  states:      {},          // { [taskId]: { checked, comment, updatedAt } }
  loading:     false,
  busy:        false,
  error:       null,
})

const { isEnabled } = useFeatureFlags()

function isCheckTypesEnabled() {
  return isEnabled('webchecker.check_types')
}

async function fetchAvailable() {
  if (!isCheckTypesEnabled()) { state.available = []; return }
  state.loading = true
  state.error = null
  try {
    const data = await apiJson(BASE)
    state.available = data.types ?? []
  } catch (e) {
    state.error = e.message
    state.available = []
  } finally {
    state.loading = false
  }
}

async function selectType(slug) {
  if (!slug) {
    state.active = null
    state.states = {}
    return
  }
  state.busy = true
  state.error = null
  try {
    const data = await apiJson(`${BASE}/${encodeURIComponent(slug)}`)
    state.active = data
  } catch (e) {
    state.error = e.message
    state.active = null
  } finally {
    state.busy = false
  }
}

/**
 * Pull persisted task-states for a given URL. Called whenever the active
 * URL changes so the auditor's previous ticks/comments show up.
 */
async function fetchStatesForUrl(url) {
  if (!state.active || !url) { state.states = {}; return }
  try {
    const params = new URLSearchParams({ url, typeId: state.active.type.id })
    const data = await apiJson(`${BASE}/states?${params.toString()}`)
    const next = {}
    for (const s of data.states ?? []) {
      next[s.taskId] = { checked: !!s.checked, comment: s.comment ?? '', updatedAt: s.updatedAt }
    }
    state.states = next
  } catch (e) {
    state.states = {}
  }
}

async function saveTaskState(taskId, { origin, url, checked, comment }) {
  try {
    const data = await apiJson(`${BASE}/states/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body:   JSON.stringify({ origin, url, checked, comment: comment ?? null }),
    })
    state.states[taskId] = {
      checked: !!data.state.checked,
      comment: data.state.comment ?? '',
      updatedAt: data.state.updatedAt,
    }
  } catch (e) {
    // Surfacing errors is the caller's job — composable doesn't toast.
    throw e
  }
}

export function useCheckTypes() {
  return {
    state,
    isCheckTypesEnabled,
    fetchAvailable,
    selectType,
    fetchStatesForUrl,
    saveTaskState,
  }
}
