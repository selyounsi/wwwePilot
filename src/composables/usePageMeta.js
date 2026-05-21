import { reactive } from 'vue'

/**
 * Lightweight page metadata extractor for the Quick-Page-Info sidebar.
 * Reads SEO meta tags, tech indicators and element counts in a single
 * `chrome.scripting.executeScript` call so the cost is one round-trip
 * per tab regardless of how many fields we render.
 *
 * Separate from `usePageDetector` so each composable stays focused —
 * the detector classifies the CMS, this one inspects the document.
 *
 *   const { state, extract } = usePageMeta()
 *   await extract({ tabId, url })
 *
 * `state` is shared + reactive so consumers see the same result.
 */

const TTL_MS = 60 * 1000

const state = reactive({
  loading: false,
  url:     null,
  seo:     null,    // { title, description, language, canonical, robots }
  tech:    null,    // { protocol, charset, viewport, favicon }
  stats:   null,    // { h1, h2, h3, images, links, forms }
  error:   null,
})

const cache = new Map()

/**
 * Runs in the page's context. Must be self-contained — serialised via
 * Function.toString() and injected, no module scope available.
 */
function scanMeta() {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null
  const ogMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? null

  const canonicalEl = document.querySelector('link[rel="canonical"]')
  const faviconEl   = document.querySelector('link[rel~="icon"]')

  return {
    seo: {
      title:       (document.title ?? '').trim() || null,
      description: meta('description') ?? ogMeta('og:description'),
      language:    document.documentElement.getAttribute('lang') || null,
      canonical:   canonicalEl?.href || null,
      robots:      meta('robots'),
    },
    tech: {
      protocol: location.protocol.replace(':', ''),
      charset:  document.characterSet || document.charset || null,
      viewport: meta('viewport'),
      favicon:  faviconEl?.href || null,
    },
    stats: {
      h1:     document.querySelectorAll('h1').length,
      h2:     document.querySelectorAll('h2').length,
      h3:     document.querySelectorAll('h3').length,
      images: document.querySelectorAll('img').length,
      links:  document.querySelectorAll('a[href]').length,
      forms:  document.querySelectorAll('form').length,
    },
  }
}

async function extract({ tabId, url, force = false } = {}) {
  if (!tabId || !url || !/^https?:/i.test(url)) {
    Object.assign(state, { loading: false, url, seo: null, tech: null, stats: null, error: null })
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
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: scanMeta })
    const result = injection?.result ?? { seo: null, tech: null, stats: null }
    cache.set(url, { result, at: Date.now() })
    Object.assign(state, result, { loading: false, url })
    return { ...state }
  } catch (e) {
    state.error = e?.message ?? String(e)
    state.loading = false
    return { ...state }
  }
}

export function usePageMeta() {
  return { state, extract }
}
