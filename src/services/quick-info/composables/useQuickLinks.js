import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

/**
 * Loads admin-defined Quick-Link templates from the backend and provides
 * a `resolve(link, ctx)` helper that expands placeholders against the
 * current tab's URL + detector result.
 *
 * Caches the per-CMS query for 5 min — links are admin-rarely-edited and
 * the sidebar re-asks on tab change for the matching CMS.
 *
 * Links are NEVER persisted client-side beyond this in-memory cache:
 * no chrome.storage, no localStorage. Cache evaporates with the page.
 */

const TTL_MS = 5 * 60 * 1000

const state = reactive({
  links:     [],
  loading:   false,
  error:     null,
  fetchedAt: 0,
  cms:       null,    // last cms we queried for
})

let pendingFetch = null

async function fetchLinks(cms, { force = false } = {}) {
  const sameCms = state.cms === (cms ?? null)
  const fresh   = sameCms && Date.now() - state.fetchedAt < TTL_MS
  if (!force && fresh && state.links.length) return state.links
  if (pendingFetch && sameCms && !force)     return pendingFetch

  state.loading = true
  state.error = null
  pendingFetch = (async () => {
    try {
      const url = cms ? `${API.quickLinks.url}/?cms=${encodeURIComponent(cms)}` : `${API.quickLinks.url}/`
      const data = await apiJson(url)
      state.links     = data.links ?? []
      state.cms       = cms ?? null
      state.fetchedAt = Date.now()
      return state.links
    } catch (e) {
      state.error = e.message
      state.links = []
      throw e
    } finally {
      state.loading = false
      pendingFetch = null
    }
  })()
  return pendingFetch
}

/**
 * Hosts containing these segments are wwwe demo / staging environments
 * that wear a slug like `<name>-<tld>` in their first label. The matching
 * live domain is recovered by turning the last `-` into `.`.
 *   selyounsi-demosite-com.duess5.dfsweb.site → selyounsi-demosite.com
 *   jobfind4you-de.wd4.securewebdemo.net      → jobfind4you.de
 */
const DEMO_HOST_PATTERN = /(securewebdemo|demosite|dfsweb)/i

function liveDomainFromDemo(host) {
  if (!host || !DEMO_HOST_PATTERN.test(host)) return null
  const first = host.split('.')[0] ?? ''
  const i = first.lastIndexOf('-')
  if (i <= 0) return null
  return first.slice(0, i) + '.' + first.slice(i + 1)
}

/**
 * Expand placeholders in a url_template using the active tab + detector
 * context. Returns `null` when a referenced placeholder is empty — e.g.
 * `<liveDomain>` on a non-demo host — so the caller can hide the link.
 * Unknown placeholders are left intact so admins notice typos.
 */
function resolve(urlTemplate, ctx = {}) {
  if (!urlTemplate) return null
  let host = '', origin = '', path = '', domain = ''
  try {
    const u = new URL(ctx.url ?? '')
    host   = u.host
    origin = u.origin
    path   = (u.pathname + u.search) || '/'
    domain = host.replace(/^www\./, '')
  } catch { /* leave defaults */ }

  const map = {
    url:        ctx.url ?? '',
    host,
    origin,
    path,
    domain,
    counterId:  ctx.counterId ?? '',
    cms:        ctx.cms ?? '',
    liveDomain: liveDomainFromDemo(host) ?? '',
  }

  let failed = false
  const out = urlTemplate.replace(/<([a-zA-Z][\w-]*)>/g, (m, key) => {
    if (!Object.hasOwn(map, key)) return m
    const v = map[key]
    if (!v) { failed = true; return '' }
    return encodeURI(String(v)).replace(/%2F/g, '/').replace(/%3A/g, ':')
  })
  return failed ? null : out
}

export function useQuickLinks() {
  return { state, fetchLinks, resolve }
}
