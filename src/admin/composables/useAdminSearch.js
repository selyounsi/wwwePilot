import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'
import { adminNav, adminNavGroups } from '@/admin/routes.js'

const state = reactive({
  query:   '',
  loading: false,
  error:   null,
  results: { pages: [], users: [], reports: [], sites: [], runs: [] },
})

let inflight = 0

/**
 * Build a flat searchable list of every admin nav entry — top-level items
 * AND sub-items inside groups. The label is what the sidebar shows, the
 * group label gives context so "Tokens" can still be found by typing
 * "api". Pre-computed once at module-load: nav is static after bootstrap.
 */
function buildPageIndex(navItems, groups) {
  return navItems.map(n => {
    const groupMeta = n.group ? groups[n.group] : null
    return {
      key:        n.key,
      path:       n.path,
      icon:       n.icon,
      label:      n.label,                // translation key (e.g. "Spellcheck")
      group:      n.group,
      groupLabel: groupMeta?.label ?? null,
      permission: n.permission,
      // Lowercased haystack we match against — covers label, key, group
      // label, group key, permission slug. Translations are layered on
      // in the view (we match on the raw English keys here).
      haystack: [
        n.label, n.key, n.group, groupMeta?.label,
        n.path, n.permission,
      ].filter(Boolean).join(' ').toLowerCase(),
    }
  })
}

const PAGE_INDEX = buildPageIndex(adminNav, adminNavGroups)

function searchPages(q, has) {
  const needle = q.toLowerCase()
  return PAGE_INDEX
    .filter(p => p.haystack.includes(needle))
    .filter(p => !p.permission || !has || has(p.permission))
    .slice(0, 8)
}

/**
 * Cross-entity admin search. Pages come from the local nav index (no
 * round-trip, works offline). Users / reports / sites / runs come from
 * the backend with inflight tracking so out-of-order responses don't
 * stomp newer queries.
 *
 * `has(slug)` is passed in from the caller (the QuickSwitcher) so the
 * page list filters out items the current user can't access.
 */
async function search(q, has) {
  state.query = q
  const trimmed = (q ?? '').trim()
  if (trimmed.length < 2) {
    state.results = { pages: [], users: [], reports: [], sites: [], runs: [] }
    state.loading = false
    state.error   = null
    return
  }

  // Pages are instant — fill them in synchronously so the user sees
  // navigation hits immediately even while the network call is in flight.
  state.results = {
    ...state.results,
    pages: searchPages(trimmed, has),
  }

  const seq = ++inflight
  state.loading = true
  state.error   = null
  try {
    const data = await apiJson(`${API.admin.url}/search?q=${encodeURIComponent(trimmed)}`)
    if (seq === inflight) {
      state.results = {
        pages:   state.results.pages,
        users:   data.users   ?? [],
        reports: data.reports ?? [],
        sites:   data.sites   ?? [],
        runs:    data.runs    ?? [],
      }
    }
  } catch (e) {
    if (seq === inflight) {
      // Backend failed but page hits stay — Cmd+K is most useful for
      // "jump to that admin section", and that doesn't need a server.
      state.results = {
        pages:   state.results.pages,
        users:   [],
        reports: [],
        sites:   [],
        runs:    [],
      }
      state.error = e?.message ?? 'request_failed'
      console.warn('[admin-search] backend failed:', e)
    }
  } finally {
    if (seq === inflight) state.loading = false
  }
}

export function useAdminSearch() {
  return { state, search }
}
