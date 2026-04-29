export const types = ['FETCH_SITEMAP']

export async function handle(msg, sendResponse) {
  switch (msg.type) {
    case 'FETCH_SITEMAP': return fetchSitemap(msg, sendResponse)
  }
}

async function fetchSitemap(msg, sendResponse) {
  try {
    const origin = msg.origin || ''
    if (!origin) { sendResponse({ error: 'Origin fehlt' }); return }
    const urls = await fetchSitemapUrls(`${origin}/sitemap.xml`)
    sendResponse({ urls })
  } catch (e) {
    sendResponse({ error: e.message, urls: [] })
  }
}

// regex-parsed because MV3 service workers don't have DOMParser
async function fetchSitemapUrls(sitemapUrl, depth = 0) {
  if (depth > 3) return []
  const res = await fetch(sitemapUrl, {
    cache:    'no-store',
    redirect: 'follow',
    signal:   AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Sitemap nicht erreichbar (HTTP ${res.status})`)
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
