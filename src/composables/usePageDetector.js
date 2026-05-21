import { reactive } from 'vue'

/**
 * Central page detector. Figures out, for any open tab:
 *   - whether it is one of *our* hosted sites (wwwe / securewebsystems),
 *   - which framework it runs (CMS3, CMS4, EverPress-on-WordPress, plain
 *     WordPress, or unknown),
 *   - the framework version when the page exposes it.
 *
 * Designed to be shared by every service/module (Quick-Info, Web-checker,
 * future tooling) via a single import. Detection is DOM-first (fast, no
 * network) with an optional path-probe pass for the rare case where the
 * DOM is inconclusive.
 *
 *   const { state, detect } = usePageDetector()
 *   await detect({ tabId, url })          // explicit tab
 *   await detect()                        // active tab
 *   await detect({ probe: true })         // force the network confirmation pass
 *
 * `state` is shared + reactive, so multiple consumers see the same result.
 */

const TTL_MS = 60 * 1000

const state = reactive({
  loading:   false,
  url:       null,
  isOurSite: null,    // bool | null (null = not yet detected)
  cms:       null,    // 'cms3' | 'cms4' | 'everpress' | 'wordpress' | 'unknown' | null
  version:   null,    // framework version string | null
  counterId: null,    // wwwe usecurez counter id (k=...) on our sites
  generator: null,    // <meta name=generator> content
  signals:   null,    // raw detection signals (for debugging / power tools)
  error:     null,
})

// url -> { result, at } cache so repeated consumers don't re-scan.
const cache = new Map()

/**
 * Runs in the page's context. Must be self-contained — it is serialised via
 * Function.toString() and injected, so it cannot reference module scope.
 */
function scanPage() {
  const html = document.documentElement

  // Any html attribute that smells like a framework version marker:
  // data-fw, data-fw-version, data-ep-version, version, …
  const versionAttrs = {}
  for (const a of html.attributes) {
    if (/(^|-)(fw|ep)(-|$)|version/i.test(a.name)) versionAttrs[a.name] = a.value
  }

  const scripts = [...document.querySelectorAll('script[src]')]
    .map(s => s.getAttribute('src') || '')
  const hasScript = (re) => scripts.some(s => re.test(s))

  // usecurez.js carries the counter id as `k=...` in its query string.
  // Same id flows through both usecurez.js and usecurezc.js, so we just
  // grab the first one we see.
  let counterId = null
  for (const s of scripts) {
    if (!/usecurez/i.test(s)) continue
    const m = s.match(/[?&]k=([^&]+)/)
    if (m) { try { counterId = decodeURIComponent(m[1]) } catch { counterId = m[1] } break }
  }

  return {
    versionAttrs,
    generator: document.querySelector('meta[name="generator"]')?.getAttribute('content') ?? null,
    counterId,
    markers: {
      usecurez:  hasScript(/\/usecurez(c)?\.js/i),
      evercdn:   hasScript(/evercdn\/assets\//i),
      ewcms3:    hasScript(/\/ewcms3\/js\/ewcms_js\.js/i),
      csiteMods: hasScript(/\/_rassets\/csite_modules\.js/i),
      everpress: hasScript(/\/(themes|plugins)\/everpress\//i),
      wordpress: hasScript(/\/wp-(content|includes)\//i),
    },
  }
}

/**
 * Pure classification from the raw scan signals. Kept separate from the DOM
 * scan so it is unit-testable and the precedence order is obvious.
 */
function classify(scan) {
  const m = scan.markers
  const v = scan.versionAttrs ?? {}

  const isOurSite = !!(m.usecurez || m.evercdn || m.everpress)

  let cms = 'unknown'
  let version = null

  if (m.ewcms3 || v['data-fw']) {
    cms = 'cms3'
    version = v['data-fw'] ?? null
  } else if (m.csiteMods || v['data-fw-version']) {
    cms = 'cms4'
    version = v['data-fw-version'] ?? null
  } else if (v['data-ep-version'] || m.everpress) {
    cms = 'everpress'
    version = v['data-ep-version'] ?? null
  } else if (m.wordpress || /wordpress/i.test(scan.generator ?? '')) {
    cms = 'wordpress'
    version = null
  }

  // Last-ditch version: any remaining version-ish attribute.
  if (!version) {
    const first = Object.entries(v).find(([, val]) => val)
    if (first) version = first[1]
  }

  return { isOurSite, cms, version, counterId: scan.counterId ?? null, generator: scan.generator, signals: scan }
}

/**
 * Known paths that are served globally for our sites / per framework. Used
 * only by the optional probe pass — DOM detection already covers the common
 * case because these all surface as <script src> tags.
 */
const PROBE_PATHS = {
  ourSite: ['/usecurez.js', '/securewebapps/evercdn/assets/requireit/v1/scripts/main.min.js', '/evercdn/assets/requireit/v1/scripts/main.min.js'],
  cms3:    ['/ewcms3/js/ewcms_js.js'],
  cms4:    ['/_rassets/csite_modules.js'],
}

async function probePath(origin, path) {
  try {
    const res = await fetch(origin + path, { method: 'GET', cache: 'no-store', redirect: 'follow' })
    return res.ok
  } catch {
    return false
  }
}

async function probeOrigin(origin) {
  const any = (results) => results.some(Boolean)
  const [our, cms3, cms4] = await Promise.all([
    Promise.all(PROBE_PATHS.ourSite.map(p => probePath(origin, p))).then(any),
    Promise.all(PROBE_PATHS.cms3.map(p => probePath(origin, p))).then(any),
    Promise.all(PROBE_PATHS.cms4.map(p => probePath(origin, p))).then(any),
  ])
  return { our, cms3, cms4 }
}

function originOf(url) {
  try { return new URL(url).origin } catch { return null }
}

async function detect({ tabId, url, probe = false, force = false } = {}) {
  // Resolve target tab if not given.
  if (!tabId || !url) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tabId ?? tab?.id
    url   = url ?? tab?.url
  }
  if (!url || !/^https?:/i.test(url)) {
    Object.assign(state, { loading: false, url, isOurSite: null, cms: null, version: null, counterId: null, generator: null, signals: null, error: null })
    return { ...state }
  }

  const cached = cache.get(url)
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    Object.assign(state, cached.result, { loading: false, url })
    return { ...state }
  }

  state.loading = true
  state.error = null
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: scanPage })
    const scan = injection?.result
    let result = classify(scan ?? { markers: {}, versionAttrs: {} })

    // Optional confirmation pass — runs when explicitly requested, or when
    // the DOM scan couldn't pin the framework / our-site flag.
    if (probe || result.cms === 'unknown' || !result.isOurSite) {
      const origin = originOf(url)
      if (origin) {
        const p = await probeOrigin(origin)
        if (!result.isOurSite && p.our) result.isOurSite = true
        if (result.cms === 'unknown') {
          if (p.cms4)      result.cms = 'cms4'
          else if (p.cms3) result.cms = 'cms3'
        }
        result.signals = { ...result.signals, probe: p }
      }
    }

    cache.set(url, { result, at: Date.now() })
    Object.assign(state, result, { loading: false, url })
    return { ...state }
  } catch (e) {
    state.error = e?.message ?? String(e)
    state.loading = false
    return { ...state }
  }
}

// Returns translation keys, NOT translated strings. Wrap the call site in
// `t()` so language switches at runtime propagate.
function cmsLabel(cms) {
  switch (cms) {
    case 'cms3':      return 'CMS3'
    case 'cms4':      return 'CMS4'
    case 'everpress': return 'EverPress (WordPress)'
    case 'wordpress': return 'WordPress'
    case 'unknown':   return 'Unknown'
    default:          return '—'
  }
}

export function usePageDetector() {
  return { state, detect, classify, cmsLabel }
}
