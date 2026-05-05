export const types = ['FETCH_SITEMAP']

export async function handle(msg, sendResponse) {
  switch (msg.type) {
    case 'FETCH_SITEMAP': return fetchSitemap(msg, sendResponse)
  }
}

async function fetchSitemap(msg, sendResponse) {
  const origin       = msg.origin || ''
  const overrideUrl  = (msg.sitemapUrl || '').trim()
  const sitemapUrl   = overrideUrl || (origin ? `${origin}/sitemap.xml` : '')
  if (!sitemapUrl) { sendResponse({ error: 'Origin fehlt', code: 'MISSING_ORIGIN' }); return }

  try {
    const urls = await fetchSitemapUrls(sitemapUrl)
    if (urls.length === 0) {
      sendResponse({ error: 'Die Sitemap enthält keine URLs', code: 'EMPTY_SITEMAP', sitemapUrl, urls: [] })
      return
    }
    sendResponse({ urls, sitemapUrl })
  } catch (e) {
    sendResponse({ error: e.message, code: e.code ?? 'FETCH_ERROR', sitemapUrl, urls: [] })
  }
}

// regex-parsed because MV3 service workers don't have DOMParser
async function fetchSitemapUrls(sitemapUrl, depth = 0) {
  if (depth > 3) return []
  let res
  try {
    res = await fetch(sitemapUrl, {
      cache:    'no-store',
      redirect: 'follow',
      signal:   AbortSignal.timeout(15_000),
    })
  } catch (e) {
    const err = new Error(`Keine Verbindung zur Sitemap (${sitemapUrl})`)
    err.code = e.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR'
    throw err
  }
  if (res.status === 404) {
    const err = new Error(`Keine Sitemap unter ${sitemapUrl} gefunden`)
    err.code  = 'NOT_FOUND'
    throw err
  }
  if (!res.ok) {
    const err = new Error(`Sitemap nicht erreichbar (HTTP ${res.status})`)
    err.code  = 'HTTP_ERROR'
    throw err
  }
  const xml = await res.text()

  const sitemapBlocks = xml.match(/<sitemap\b[^>]*>[\s\S]*?<\/sitemap>/g) ?? []
  if (sitemapBlocks.length > 0) {
    const childSitemaps = sitemapBlocks.map(extractFirstLoc).filter(Boolean)
    const nested = await Promise.all(childSitemaps.map(u => fetchSitemapUrls(u, depth + 1).catch(() => [])))
    return Array.from(new Set(nested.flat()))
  }

  // \b after "loc" prevents matching <image:loc>
  const urlBlocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/g) ?? []
  return urlBlocks.map(extractFirstLoc).filter(Boolean)
}

function extractFirstLoc(block) {
  const m = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/)
  return m ? m[1].trim() : ''
}
