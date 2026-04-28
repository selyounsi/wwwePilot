export const checkOnReload = false
export const allowChatBot  = false
export const overlay       = null

export default async function check() {

  const html = document.documentElement
  const head = document.head

  const lang         = html.lang                                                                  || ''
  const fwVersion    = html.dataset.fwVersion                                                     || ''
  const websiteBrand = document.querySelector('script[data-website-brand]')?.dataset.websiteBrand || ''

  // counter id is the k=XXXX query param on the usecurez.js script
  const counterEl  = document.querySelector('script[src*="usecurez"]')
  const counterSrc = counterEl?.src || counterEl?.getAttribute('src') || ''
  let counterId = ''
  try { counterId = new URL(counterSrc, location.origin).searchParams.get('k') || '' } catch {}

  const metaTitle       = document.title                                                          || ''
  const metaDescription = document.querySelector('meta[name="description"]')?.content            || ''
  const canonical       = document.querySelector('link[rel="canonical"]')?.href                  || ''
  const ogTitle         = document.querySelector('meta[property="og:title"]')?.content           || ''
  const ogDescription   = document.querySelector('meta[property="og:description"]')?.content     || ''
  const ogImage         = document.querySelector('meta[property="og:image"]')?.content           || ''
  const viewport        = document.querySelector('meta[name="viewport"]')?.content               || ''
  const themeColor      = document.querySelector('meta[name="theme-color"]')?.content            || ''

  let privacyControlVersion = ''
  try { privacyControlVersion = window.privacyControl?.version || '' } catch {}

  // same-origin fetch — runs in page context so no CORS preflight
  async function fetchCheck(url, method = 'GET') {
    try {
      const res  = await fetch(url, { method, cache: 'reload' })
      const text = method === 'GET' ? await res.text() : ''
      return { ok: res.ok, status: res.status, text, contentType: res.headers.get('content-type') || '' }
    } catch (e) {
      return { ok: false, status: 0, text: '', error: e.message }
    }
  }

  async function checkImageDimensions(url) {
    return new Promise(resolve => {
      const img = new Image()
      img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 0, height: 0 })
      img.src = url + '?_=' + Date.now()
    })
  }

  const [robotsRaw, sitemapRaw, faviconRaw] = await Promise.all([
    fetchCheck(`${location.origin}/robots.txt`),
    fetchCheck(`${location.origin}/sitemap.xml`),
    fetchCheck(`${location.origin}/favicon.ico`, 'HEAD'),
  ])

  const faviconDims = faviconRaw.ok
    ? await checkImageDimensions(`${location.origin}/favicon.ico`)
    : { width: 0, height: 0 }

  const server = {
    robots:  { ...robotsRaw,  hasSitemapRef: /^sitemap:/im.test(robotsRaw.text) },
    sitemap: { ...sitemapRaw, isXml: sitemapRaw.text.trimStart().startsWith('<?xml') || sitemapRaw.text.includes('<urlset') || sitemapRaw.text.includes('<sitemapindex') },
    favicon: { ...faviconRaw, width: faviconDims.width, height: faviconDims.height },
  }

  const { addItem, finish } = createCheckResult()

  function add(id, name, details, category, checks) {
    addItem(head, checks, { id, name, details: details || '', category, visible: true, _meta: {} })
  }

  add('robots', 'robots.txt', server.robots?.ok ? `HTTP ${server.robots.status}` : 'Nicht erreichbar', 'Technik', [
    { when: !server.robots?.ok,                                    type: 'error',   title: 'robots.txt nicht erreichbar' },
    { when: server.robots?.ok && !server.robots?.hasSitemapRef,    type: 'warning', title: 'robots.txt hat keinen Sitemap-Verweis' },
    { when: server.robots?.ok && server.robots?.hasSitemapRef,     type: 'success', title: 'robots.txt vorhanden & vollständig' },
  ])

  add('sitemap', 'sitemap.xml', server.sitemap?.ok ? `HTTP ${server.sitemap.status}` : 'Nicht erreichbar', 'Technik', [
    { when: !server.sitemap?.ok,                                   type: 'error',   title: 'sitemap.xml nicht erreichbar' },
    { when: server.sitemap?.ok && !server.sitemap?.isXml,          type: 'warning', title: 'sitemap.xml: kein valides XML-Format' },
    { when: server.sitemap?.ok && server.sitemap?.isXml,           type: 'success', title: 'sitemap.xml vorhanden' },
  ])

  const fav = server.favicon
  const favDetails = !fav.ok
    ? 'Nicht gefunden'
    : fav.width && fav.height
      ? `${fav.width}×${fav.height}px`
      : `HTTP ${fav.status}`
  add('favicon', 'Favicon (favicon.ico)', favDetails, 'Technik', [
    { when: !fav.ok,                                               type: 'error',   title: 'favicon.ico nicht erreichbar' },
    { when: fav.ok && fav.width > 0 && (fav.width !== 192 || fav.height !== 192),
                                                                   type: 'warning', title: `favicon.ico gefunden, aber ${fav.width}×${fav.height}px – erwartet 192×192` },
    { when: fav.ok && fav.width === 192 && fav.height === 192,     type: 'success', title: 'favicon.ico vorhanden und 192×192px' },
  ])

  add('counter', 'Counter', counterId || (counterSrc ? 'Key fehlt' : 'Nicht eingebunden'), 'Technik', [
    { when: !counterSrc,                                           type: 'warning', title: 'Counter-Script (usecurez) nicht gefunden' },
    { when: counterSrc && !counterId,                              type: 'error',   title: 'Counter: k=-Parameter (Key) fehlt' },
    { when: counterSrc && !!counterId,                             type: 'success', title: `Counter eingebunden (${counterId})` },
  ])

  add('privacy-control', 'Privacy Control',
    privacyControlVersion ? `v${privacyControlVersion}` : 'Nicht geladen', 'Technik', [
    { when: !privacyControlVersion,                                type: 'warning', title: 'privacyControl nicht geladen oder initialisiert' },
    { when: !!privacyControlVersion,                               type: 'success', title: `privacyControl v${privacyControlVersion}` },
  ])

  const titleLen = metaTitle.length
  add('meta-title', 'Meta Title',
    metaTitle ? `${titleLen} Zeichen: ${metaTitle.slice(0, 50)}${titleLen > 50 ? '…' : ''}` : '–', 'SEO', [
    { when: !metaTitle,                                            type: 'error',   title: 'Kein Seiten-Title vorhanden' },
    { when: metaTitle && titleLen < 30,                            type: 'warning', title: `Title zu kurz (${titleLen} / 30–60 Zeichen)` },
    { when: metaTitle && titleLen > 60,                            type: 'warning', title: `Title zu lang (${titleLen} / 30–60 Zeichen)` },
    { when: metaTitle && titleLen >= 30 && titleLen <= 60,         type: 'success', title: `Meta Title OK (${titleLen} Zeichen)` },
  ])

  const descLen = metaDescription.length
  add('meta-desc', 'Meta Description',
    metaDescription ? `${descLen} Zeichen: ${metaDescription.slice(0, 55)}${descLen > 55 ? '…' : ''}` : '–', 'SEO', [
    { when: !metaDescription,                                      type: 'error',   title: 'Keine Meta-Description vorhanden' },
    { when: metaDescription && descLen < 120,                      type: 'warning', title: `Description zu kurz (${descLen} / 120–160 Zeichen)` },
    { when: metaDescription && descLen > 160,                      type: 'warning', title: `Description zu lang (${descLen} / 120–160 Zeichen)` },
    { when: metaDescription && descLen >= 120 && descLen <= 160,   type: 'success', title: `Meta Description OK (${descLen} Zeichen)` },
  ])

  add('canonical', 'Canonical', canonical || '–', 'SEO', [
    { when: !canonical,                                            type: 'warning', title: 'Kein Canonical-Tag vorhanden' },
    { when: !!canonical,                                           type: 'success', title: 'Canonical-Tag vorhanden' },
  ])

  const ogMissing = [!ogTitle && 'og:title', !ogDescription && 'og:description', !ogImage && 'og:image'].filter(Boolean)
  add('og-tags', 'Open Graph',
    ogMissing.length ? `Fehlt: ${ogMissing.join(', ')}` : 'title, description, image', 'SEO', [
    { when: ogMissing.length > 0,                                  type: 'warning', title: `OG-Tags unvollständig – fehlt: ${ogMissing.join(', ')}` },
    { when: ogMissing.length === 0,                                type: 'success', title: 'Open Graph vollständig' },
  ])

  add('html-lang', 'Sprache (lang)', lang || '–', 'HTML', [
    { when: !lang,                                                 type: 'warning', title: 'lang-Attribut fehlt am <html>-Tag' },
    { when: !!lang,                                                type: 'success', title: `Sprache gesetzt: ${lang}` },
  ])

  add('viewport', 'Viewport Meta', viewport ? 'Vorhanden' : '–', 'HTML', [
    { when: !viewport,                                             type: 'warning', title: 'Viewport-Meta-Tag fehlt' },
    { when: !!viewport,                                            type: 'success', title: 'Viewport-Meta vorhanden' },
  ])

  const isDefaultThemeColor = ['#000', '#000000', 'black'].includes(themeColor.trim().toLowerCase())
  add('theme-color', 'Theme-Color', themeColor || '–', 'HTML', [
    { when: !themeColor,                                           type: 'warning', title: 'theme-color Meta-Tag fehlt' },
    { when: themeColor && isDefaultThemeColor,                     type: 'warning', title: `theme-color hat Standardfarbe "${themeColor}" – sollte an Brand angepasst werden` },
    { when: themeColor && !isDefaultThemeColor,                    type: 'success', title: `theme-color: ${themeColor}` },
  ])

  return finish()
}
