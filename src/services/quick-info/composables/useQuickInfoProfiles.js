import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const TTL_MS = 5 * 60 * 1000

const state = reactive({
  profiles:    [],
  loading:     false,
  error:       null,
  fetchedAt:   0,
})

let pendingFetch = null

async function fetchProfiles({ force = false } = {}) {
  const fresh = Date.now() - state.fetchedAt < TTL_MS
  if (!force && fresh && state.profiles.length) return state.profiles
  if (pendingFetch) return pendingFetch

  state.loading = true
  state.error = null
  pendingFetch = (async () => {
    try {
      const data = await apiJson(`${API.quickInfo.url}/profiles`)
      state.profiles  = data.profiles ?? []
      state.fetchedAt = Date.now()
      return state.profiles
    } catch (e) {
      state.error = e.message
      throw e
    } finally {
      state.loading = false
      pendingFetch = null
    }
  })()
  return pendingFetch
}

/**
 * Find the first profile whose `urlPattern` regex matches the given URL.
 * Patterns are admin-authored; invalid regex compiles fall through silently
 * so one bad profile can't block the rest.
 */
function matchProfile(url) {
  if (!url) return null
  for (const p of state.profiles) {
    try {
      if (new RegExp(p.urlPattern).test(url)) return p
    } catch {
      continue
    }
  }
  return null
}

export function useQuickInfoProfiles() {
  return { state, fetchProfiles, matchProfile }
}
