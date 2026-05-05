import { reactive } from 'vue'

// status: 'idle' | 'fetching' | 'preflight' | 'running' | 'paused' | 'done' | 'error'
// urlSelection / moduleSelection: missing key = default-selected.
const state = reactive({
  status:           'idle',
  error:            null,
  errorCode:        null,
  sitemapUrl:       null,
  origin:           null,
  urls:             [],
  results:          {},
  currentUrl:       null,
  currentIdx:       0,
  runningModuleIds: [],
  checkTabId:       null,
  urlSelection:     {},
  moduleSelection:  {},
  startedAt:        null,
  finishedAt:       null,
  // Driven from anywhere (cancel button, route guard) so the run loop survives
  // a view unmount without losing its kill-switch.
  cancelled:        false,
})

export function useSiteCheckStore() {
  // selections + cascade preference persist across reset so "Erneut prüfen"
  // keeps the user's choices.
  function reset() {
    state.status = 'idle'
    state.error = null
    state.errorCode = null
    state.sitemapUrl = null
    state.origin = null
    state.urls = []
    state.results = {}
    state.currentUrl = null
    state.currentIdx = 0
    state.runningModuleIds = []
    state.checkTabId = null
    state.startedAt = null
    state.finishedAt = null
    state.cancelled = false
  }

  function requestCancel() { state.cancelled = true }
  function clearCancel()   { state.cancelled = false }

  function startFetching(origin) {
    reset()
    state.status = 'fetching'
    state.origin = origin
  }

  function setUrls(urls) {
    state.urls = urls
  }

  function enterPreflight() {
    state.status = 'preflight'
  }

  function startRunning() {
    state.status = 'running'
    state.startedAt = Date.now()
    state.currentIdx = 0
  }

  function isUrlSelected(url)    { return state.urlSelection[url]       !== false }
  function isModuleSelected(id)  { return state.moduleSelection[id]     !== false }

  function setUrlSelected(url, selected) {
    state.urlSelection[url] = !!selected
  }
  function setModuleSelected(id, selected) {
    state.moduleSelection[id] = !!selected
  }

  function setAllUrlsSelected(urls, selected) {
    for (const u of urls) state.urlSelection[u] = !!selected
  }
  function setAllModulesSelected(ids, selected) {
    for (const id of ids) state.moduleSelection[id] = !!selected
  }

  function setPaused(paused) {
    state.status = paused ? 'paused' : 'running'
  }

  function setCheckTabId(id) {
    state.checkTabId = id
  }

  function setCurrent(url, idx) {
    state.currentUrl = url
    state.currentIdx = idx
  }

  function setRunningModules(ids) {
    state.runningModuleIds = [...ids]
  }

  function markModuleDone(id) {
    state.runningModuleIds = state.runningModuleIds.filter(i => i !== id)
  }

  function setUrlResult(url, moduleId, result) {
    if (!state.results[url]) state.results[url] = {}
    state.results[url][moduleId] = result
  }

  // Mirror fresh single-check results back into the overview so fixes show up
  // without re-running the whole site. Trailing-slash tolerant.
  function syncFromSingleCheck(url, moduleId, result) {
    if (!url) return
    const target = state.urls.includes(url)
      ? url
      : state.urls.find(u => normalizeUrl(u) === normalizeUrl(url))
    if (!target) return
    if (!state.results[target]) state.results[target] = {}
    state.results[target][moduleId] = {
      status:       'done',
      errors:       result.errors       ?? [],
      warnings:     result.warnings     ?? [],
      errorCount:   result.errorCount   ?? result.errors?.length   ?? 0,
      warningCount: result.warningCount ?? result.warnings?.length ?? 0,
      items:        result.items        ?? [],
    }
  }

  function normalizeUrl(u) {
    try {
      const parsed = new URL(u)
      const path   = parsed.pathname.replace(/\/+$/, '') || '/'
      return parsed.origin.toLowerCase() + path + parsed.search
    } catch {
      return u
    }
  }

  function setError(msg, code = null, sitemapUrl = null) {
    state.status     = 'error'
    state.error      = msg
    state.errorCode  = code
    if (sitemapUrl)  state.sitemapUrl = sitemapUrl
  }

  function setSitemapUrl(url) { state.sitemapUrl = url }

  function finish() {
    state.status = 'done'
    state.finishedAt = Date.now()
    state.currentUrl = null
    state.runningModuleIds = []
  }

  return {
    state, reset, startFetching, setUrls, setSitemapUrl, enterPreflight, startRunning, setCurrent,
    setPaused, setCheckTabId,
    setRunningModules, markModuleDone,
    setUrlResult, syncFromSingleCheck, setError, finish,
    isUrlSelected, isModuleSelected,
    setUrlSelected, setModuleSelected, setAllUrlsSelected, setAllModulesSelected,
    requestCancel, clearCancel,
  }
}
