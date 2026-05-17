import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/spellcheck`

const state = reactive({
  domains:        [],
  dictionary:     [],
  ignoredErrors:  [],
  discovered:     null,        // last /discover response: { url, urls[], total }
  lastResult:     null,        // last /check-site response (slug + summary)
  runs:           [],          // history rows for the active domain
  runDetail:      null,        // full upstream result for a single slug
  overview:       [],          // cross-domain rollup
  loadingDomains: false,
  loadingDomain:  false,
  loadingRuns:    false,
  loadingDetail:  false,
  loadingOverview:false,
  busy:           false,
  error:          null,
})

async function fetchOverview() {
  state.loadingOverview = true
  try {
    const data = await apiJson(`${BASE}/overview`)
    state.overview = data.overview ?? []
  } catch (e) {
    state.overview = []
  } finally {
    state.loadingOverview = false
  }
}

async function fetchDomains() {
  state.loadingDomains = true
  state.error = null
  try {
    const data = await apiJson(`${BASE}/domains`)
    state.domains = data.domains ?? []
  } catch (e) {
    state.error = e.message
  } finally {
    state.loadingDomains = false
  }
}

async function fetchDomainData(domain) {
  state.loadingDomain = true
  state.error = null
  try {
    const [dict, ignored] = await Promise.all([
      apiJson(`${BASE}/domains/${encodeURIComponent(domain)}/dictionary`),
      apiJson(`${BASE}/domains/${encodeURIComponent(domain)}/ignored-errors`),
    ])
    state.dictionary    = dict.words      ?? []
    state.ignoredErrors = ignored.entries ?? []
  } catch (e) {
    state.error = e.message
    state.dictionary    = []
    state.ignoredErrors = []
  } finally {
    state.loadingDomain = false
  }
}

async function fetchRuns(domain) {
  state.loadingRuns = true
  try {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : ''
    const data = await apiJson(`${BASE}/runs${params}`)
    state.runs = data.runs ?? []
  } catch (e) {
    state.runs = []
  } finally {
    state.loadingRuns = false
  }
}

async function fetchRunDetail(slug) {
  state.loadingDetail = true
  state.runDetail = null
  try {
    state.runDetail = await apiJson(`${BASE}/runs/${encodeURIComponent(slug)}`)
    return state.runDetail
  } catch (e) {
    state.error = e.message
    return null
  } finally {
    state.loadingDetail = false
  }
}

async function discover(domain) {
  state.busy = true
  state.discovered = null
  try {
    const result = await apiJson(`${BASE}/discover`, {
      method: 'POST',
      body:   JSON.stringify({ url: domain }),
    })
    state.discovered = result
    return result
  } finally {
    state.busy = false
  }
}

async function addDictionaryWord(domain, word, force = false) {
  state.busy = true
  try {
    const r = await apiJson(`${BASE}/domains/${encodeURIComponent(domain)}/dictionary`, {
      method: 'POST',
      body:   JSON.stringify({ word, force }),
    })
    await fetchDomainData(domain)
    return r
  } finally {
    state.busy = false
  }
}

async function bulkAddDictionary(domain, words, force = false) {
  state.busy = true
  try {
    const r = await apiJson(`${BASE}/domains/${encodeURIComponent(domain)}/dictionary/bulk`, {
      method: 'POST',
      body:   JSON.stringify({ words, force }),
    })
    await fetchDomainData(domain)
    return r
  } finally {
    state.busy = false
  }
}

async function removeDictionaryWord(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/dictionary/${encodeURIComponent(id)}`, { method: 'DELETE' })
    state.dictionary = state.dictionary.filter(w => w.id !== id)
  } finally {
    state.busy = false
  }
}

async function addIgnoredError(domain, errorText) {
  state.busy = true
  try {
    const r = await apiJson(`${BASE}/domains/${encodeURIComponent(domain)}/ignored-errors`, {
      method: 'POST',
      body:   JSON.stringify({ error_text: errorText }),
    })
    await fetchDomainData(domain)
    return r
  } finally {
    state.busy = false
  }
}

async function removeIgnoredError(id) {
  state.busy = true
  try {
    await apiJson(`${BASE}/ignored-errors/${encodeURIComponent(id)}`, { method: 'DELETE' })
    state.ignoredErrors = state.ignoredErrors.filter(e => e.id !== id)
  } finally {
    state.busy = false
  }
}

/**
 * Triggers a full discover + bulk-check upstream. `options` may include
 * `maxPages` (1..500) and `language` (de-DE / en-US / en-GB).
 */
async function checkSite(domain, options = {}) {
  state.busy = true
  try {
    const result = await apiJson(`${BASE}/check-site`, {
      method: 'POST',
      body:   JSON.stringify({ url: domain, ...options }),
    })
    state.lastResult = result
    return result
  } finally {
    state.busy = false
  }
}

export function useAdminSpellcheck() {
  return {
    state,
    fetchOverview,
    fetchDomains, fetchDomainData,
    fetchRuns, fetchRunDetail,
    discover,
    addDictionaryWord, bulkAddDictionary, removeDictionaryWord,
    addIgnoredError, removeIgnoredError,
    checkSite,
  }
}
