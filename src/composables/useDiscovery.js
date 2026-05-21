import { reactive } from 'vue'

/**
 * Fetches /robots.txt and /sitemap.xml from the active tab's origin and
 * answers two quick crawler questions:
 *   1. Is this URL crawlable for Googlebot (robots.txt allow/disallow)?
 *   2. Is this URL in the sitemap, and when was the sitemap last updated?
 *
 * Runs from the sidebar's privileged context (`<all_urls>` host_permission)
 * so cross-origin GET is allowed without CORS. Caches per origin for 5 min
 * because robots/sitemap rarely change tab-to-tab.
 *
 * Sitemap-index files are followed one level deep — we read the index,
 * pick the first child sitemap, fetch its URL list. Deeper trees are
 * surfaced as a count + lastmod range only.
 */

const TTL_MS = 5 * 60 * 1000
const MAX_BYTES = 2 * 1024 * 1024    // hard cap so a huge sitemap doesn't OOM the sidebar
const MAX_URLS  = 5000               // how many <url><loc> entries we parse per sitemap

const state = reactive({
  loading:  false,
  origin:   null,
  url:      null,
  robots:   null,   // { status, allowed, crawlDelay, sitemaps: string[], raw }
  sitemap:  null,   // { status, urlCount, urls: string[], lastMod, isIndex, indexChildren }
  error:    null,
})

const cache = new Map()    // origin -> { result, at }

async function fetchText(url) {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' })
    if (!res.ok) return { status: res.status, text: null }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) return { status: res.status, text: null, oversize: true }
    return { status: res.status, text: new TextDecoder('utf-8').decode(buf) }
  } catch (e) {
    return { status: 0, text: null, error: e?.message ?? String(e) }
  }
}

/** Minimal robots.txt parser — only what we surface in the UI. */
function parseRobots(text) {
  const sitemaps = []
  // Map<userAgent, { allow: string[], disallow: string[], crawlDelay?: number }>
  const groups = new Map()
  let current = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = line.match(/^([a-z-]+)\s*:\s*(.+)$/i)
    if (!m) continue
    const [, key, value] = m
    const lower = key.toLowerCase()

    if (lower === 'user-agent') {
      const ua = value.trim().toLowerCase()
      current = groups.get(ua) ?? { allow: [], disallow: [], crawlDelay: null }
      groups.set(ua, current)
    } else if (lower === 'sitemap') {
      sitemaps.push(value.trim())
    } else if (current) {
      if (lower === 'allow')           current.allow.push(value.trim())
      else if (lower === 'disallow')   current.disallow.push(value.trim())
      else if (lower === 'crawl-delay') current.crawlDelay = Number(value.trim()) || null
    }
  }
  return { sitemaps, groups }
}

/**
 * Apply robots.txt rules to a given pathname.
 * Returns { allowed: bool, matchedRule: string|null, crawlDelay: number|null }.
 *
 * Spec-compliant precedence: most-specific (longest) match wins; on a tie
 * Allow beats Disallow. We check the `googlebot` group first and fall
 * back to `*`.
 */
function isAllowed(groups, pathname) {
  const bot = groups.get('googlebot') ?? groups.get('*')
  if (!bot) return { allowed: true, matchedRule: null, crawlDelay: null }

  const candidates = [
    ...bot.allow.map(p => ({ kind: 'allow', pattern: p })),
    ...bot.disallow.map(p => ({ kind: 'disallow', pattern: p })),
  ]
  let best = null
  for (const c of candidates) {
    if (!c.pattern) continue   // empty Disallow: means "allow everything"
    if (pathname.startsWith(c.pattern)) {
      if (!best || c.pattern.length > best.pattern.length ||
          (c.pattern.length === best.pattern.length && c.kind === 'allow')) {
        best = c
      }
    }
  }
  const allowed = !best || best.kind === 'allow'
  return { allowed, matchedRule: best ? `${best.kind === 'allow' ? 'Allow' : 'Disallow'}: ${best.pattern}` : null, crawlDelay: bot.crawlDelay }
}

/**
 * Parses a urlset / sitemapindex XML document. Limits at MAX_URLS entries
 * to keep the sidebar snappy on big sitemaps.
 */
function parseSitemap(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) return null

  const isIndex = doc.documentElement?.localName === 'sitemapindex'
  if (isIndex) {
    const children = [...doc.querySelectorAll('sitemap > loc')].map(n => n.textContent.trim()).filter(Boolean)
    return { isIndex: true, indexChildren: children, urls: [], urlCount: 0, lastMod: null }
  }

  const entries = [...doc.querySelectorAll('url')].slice(0, MAX_URLS)
  const urls = entries.map(u => u.querySelector('loc')?.textContent?.trim()).filter(Boolean)
  const lastMods = entries.map(u => u.querySelector('lastmod')?.textContent?.trim()).filter(Boolean)
  const lastMod = lastMods.sort().slice(-1)[0] ?? null

  return { isIndex: false, indexChildren: [], urls, urlCount: urls.length, lastMod }
}

/**
 * `pathname` is the active URL we want to check membership for. We compare
 * against both absolute URLs and the trailing pathname so a sitemap entry
 * `https://www.example.com/foo` matches when the user is on `/foo`.
 */
function urlMatches(needle, haystack) {
  if (haystack.length === 0) return false
  let needlePath
  try { needlePath = new URL(needle).pathname } catch { needlePath = needle }

  const norm = (s) => s.replace(/\/+$/, '') || '/'
  const targetA = norm(needle)
  const targetB = norm(needlePath)

  for (const entry of haystack) {
    if (norm(entry) === targetA) return true
    try { if (norm(new URL(entry).pathname) === targetB) return true } catch { /* keep going */ }
  }
  return false
}

async function inspect({ url, force = false } = {}) {
  if (!url || !/^https?:/i.test(url)) {
    Object.assign(state, { loading: false, origin: null, url, robots: null, sitemap: null, error: null })
    return { ...state }
  }

  let origin, pathname
  try {
    const u = new URL(url)
    origin = u.origin
    pathname = u.pathname || '/'
  } catch {
    state.error = 'Invalid URL'
    return { ...state }
  }

  const cached = cache.get(origin)
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    // Re-derive per-URL fields from cached origin data so navigating within
    // the same site reuses the network result.
    const fresh = recomputeForUrl(cached.result, pathname, url)
    Object.assign(state, fresh, { loading: false, origin, url })
    return { ...state }
  }

  state.loading = true
  state.error = null

  try {
    const [robotsRes, sitemapRes] = await Promise.all([
      fetchText(`${origin}/robots.txt`),
      fetchText(`${origin}/sitemap.xml`),
    ])

    let robots = null
    let parsedGroups = null
    let sitemapHints = []
    if (robotsRes.text) {
      const parsed = parseRobots(robotsRes.text)
      parsedGroups = parsed.groups
      sitemapHints = parsed.sitemaps
      robots = {
        status:     robotsRes.status,
        sitemaps:   sitemapHints,
        raw:        robotsRes.text.slice(0, 2000),
      }
    } else {
      robots = { status: robotsRes.status, sitemaps: [], raw: null }
    }

    // Sitemap: try direct sitemap.xml, fall back to first hint in robots.txt.
    let sitemap = null
    let sitemapUrl = sitemapRes.status === 200 && sitemapRes.text ? `${origin}/sitemap.xml` : null
    let sitemapText = sitemapRes.text
    let sitemapStatus = sitemapRes.status

    if (!sitemapText && sitemapHints.length) {
      // Only follow same-origin hints — cross-origin sitemaps stay out of scope.
      const hint = sitemapHints.find(h => { try { return new URL(h).origin === origin } catch { return false } })
      if (hint) {
        sitemapUrl = hint
        const fb = await fetchText(hint)
        sitemapText = fb.text
        sitemapStatus = fb.status
      }
    }

    if (sitemapText) {
      const parsed = parseSitemap(sitemapText)
      if (parsed?.isIndex && parsed.indexChildren.length) {
        // One level deep: pull the first child to give some URL membership signal.
        const first = parsed.indexChildren[0]
        const child = await fetchText(first)
        const childParsed = child.text ? parseSitemap(child.text) : null
        sitemap = {
          status:        sitemapStatus,
          url:           sitemapUrl,
          isIndex:       true,
          indexChildren: parsed.indexChildren,
          urls:          childParsed?.urls ?? [],
          urlCount:      childParsed?.urlCount ?? 0,
          lastMod:       childParsed?.lastMod ?? null,
          followedChild: first,
        }
      } else if (parsed) {
        sitemap = {
          status:        sitemapStatus,
          url:           sitemapUrl,
          isIndex:       false,
          indexChildren: [],
          urls:          parsed.urls,
          urlCount:      parsed.urlCount,
          lastMod:       parsed.lastMod,
        }
      } else {
        sitemap = { status: sitemapStatus, url: sitemapUrl, isIndex: false, indexChildren: [], urls: [], urlCount: 0, lastMod: null, parseError: true }
      }
    } else {
      sitemap = { status: sitemapStatus, url: null, isIndex: false, indexChildren: [], urls: [], urlCount: 0, lastMod: null }
    }

    const cached = { origin, robots, sitemap, parsedGroups }
    cache.set(origin, { result: cached, at: Date.now() })

    const fresh = recomputeForUrl(cached, pathname, url)
    Object.assign(state, fresh, { loading: false, origin, url })
    return { ...state }
  } catch (e) {
    state.error = e?.message ?? String(e)
    state.loading = false
    return { ...state }
  }
}

/** Per-URL fields derived from per-origin data — re-run on tab change. */
function recomputeForUrl(originData, pathname, fullUrl) {
  const robots = originData.robots ? { ...originData.robots } : null
  if (robots && originData.parsedGroups) {
    const rule = isAllowed(originData.parsedGroups, pathname)
    robots.allowed     = rule.allowed
    robots.matchedRule = rule.matchedRule
    robots.crawlDelay  = rule.crawlDelay
  } else if (robots) {
    robots.allowed = true   // no robots.txt = full crawl
  }

  const sitemap = originData.sitemap ? { ...originData.sitemap } : null
  if (sitemap) {
    sitemap.inSitemap = urlMatches(fullUrl, sitemap.urls)
  }
  return { robots, sitemap, error: null }
}

export function useDiscovery() {
  return { state, inspect }
}
