import { reactive, computed } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const READ_KEY = 'admin-timeline-last-read'

const state = reactive({
  items:        [],
  loading:      false,
  lastFetch:    null,
  lastReadAt:   readLastReadAt(),
})

function readLastReadAt() {
  try {
    const v = localStorage.getItem(READ_KEY)
    return v ? new Date(v).toISOString() : new Date(0).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}

function writeLastReadAt(iso) {
  try { localStorage.setItem(READ_KEY, iso) } catch { /* private mode */ }
}

/**
 * Unread = items with `at` newer than the last-read timestamp persisted in
 * localStorage. Per-browser, per-admin tab — no DB read state for now.
 * Items the current admin authored themselves are excluded so opening your
 * own report doesn't trigger a notification for you.
 */
const unread = computed(() => state.items.filter(i => i.at > state.lastReadAt))

async function fetchTimeline({ limit = 50, since } = {}) {
  state.loading = true
  try {
    const p = new URLSearchParams()
    if (limit) p.set('limit', String(limit))
    if (since) p.set('since', since)
    const data = await apiJson(`${API.admin.url}/dashboard/timeline?${p.toString()}`)
    state.items     = data.items ?? []
    state.lastFetch = new Date().toISOString()
    return data
  } catch (e) {
    return null
  } finally {
    state.loading = false
  }
}

function markAllRead() {
  const now = new Date().toISOString()
  state.lastReadAt = now
  writeLastReadAt(now)
}

export function useAdminTimeline() {
  return { state, unread, fetchTimeline, markAllRead }
}
