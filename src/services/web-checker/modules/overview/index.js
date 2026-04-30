export const overlay = null

export default async function check() {
  const t = window.__t

  const html = document.documentElement
  const head = document.head

  const lang         = html.lang                                                                  || ''
  const fwVersion    = html.dataset.fwVersion                                                     || ''
  const websiteBrand = document.querySelector('script[data-website-brand]')?.dataset.websiteBrand || ''

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

  async function fetchCheck(url, method = 'GET') {
    const opts = {
      method,
      cache:    'no-store',
      redirect: 'follow',
      headers:  { 'Cache-Control': 'no-cache' },
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res  = await fetch(url, { ...opts, signal: AbortSignal.timeout(10_000) })
        const text = method === 'GET' ? await res.text() : ''
        return { ok: res.ok, status: res.status, text, contentType: res.headers.get('content-type') || '' }
      } catch (e) {
        if (attempt === 0) { await new Promise(r => setTimeout(r, 500)); continue }
        return { ok: false, status: 0, text: '', error: e.message }
      }
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

  add('robots', 'robots.txt', server.robots?.ok ? `HTTP ${server.robots.status}` : t('Not reachable'), t('Technical'), [
    { when: !server.robots?.ok,                                    type: 'error',   title: t('robots.txt not reachable') },
    { when: server.robots?.ok && !server.robots?.hasSitemapRef,    type: 'warning', title: t('robots.txt has no sitemap reference') },
    { when: server.robots?.ok && server.robots?.hasSitemapRef,     type: 'success', title: t('robots.txt present & complete') },
  ])

  add('sitemap', 'sitemap.xml', server.sitemap?.ok ? `HTTP ${server.sitemap.status}` : t('Not reachable'), t('Technical'), [
    { when: !server.sitemap?.ok,                                   type: 'error',   title: t('sitemap.xml not reachable') },
    { when: server.sitemap?.ok && !server.sitemap?.isXml,          type: 'warning', title: t('sitemap.xml: not valid XML') },
    { when: server.sitemap?.ok && server.sitemap?.isXml,           type: 'success', title: t('sitemap.xml present') },
  ])

  const fav = server.favicon
  const favDetails = !fav.ok
    ? t('Not found')
    : fav.width && fav.height
      ? `${fav.width}×${fav.height}px`
      : `HTTP ${fav.status}`
  add('favicon', t('Favicon (favicon.ico)'), favDetails, t('Technical'), [
    { when: !fav.ok,                                               type: 'error',   title: t('favicon.ico not reachable') },
    { when: fav.ok && fav.width > 0 && (fav.width !== 192 || fav.height !== 192),
                                                                   type: 'warning', title: t('favicon.ico found, but {w}×{h}px — expected 192×192', { w: fav.width, h: fav.height }) },
    { when: fav.ok && fav.width === 192 && fav.height === 192,     type: 'success', title: t('favicon.ico present and 192×192px') },
  ])

  add('counter', 'Counter', counterId || (counterSrc ? t('Key missing') : t('Not embedded')), t('Technical'), [
    { when: !counterSrc,                                           type: 'warning', title: t('Counter script (usecurez) not found') },
    { when: counterSrc && !counterId,                              type: 'error',   title: t('Counter: k= parameter (key) missing') },
    { when: counterSrc && !!counterId,                             type: 'success', title: t('Counter embedded ({id})', { id: counterId }) },
  ])

  add('privacy-control', 'Privacy Control',
    privacyControlVersion ? `v${privacyControlVersion}` : t('Not loaded'), t('Technical'), [
    { when: !privacyControlVersion,                                type: 'warning', title: t('privacyControl not loaded or initialised') },
    { when: !!privacyControlVersion,                               type: 'success', title: `privacyControl v${privacyControlVersion}` },
  ])

  const titleLen = metaTitle.length
  add('meta-title', t('Meta Title'),
    metaTitle ? t('{len} chars: {snippet}', { len: titleLen, snippet: `${metaTitle.slice(0, 50)}${titleLen > 50 ? '…' : ''}` }) : '–', 'SEO', [
    { when: !metaTitle,                                            type: 'error',   title: t('No page title') },
    { when: metaTitle && titleLen < 30,                            type: 'warning', title: t('Title too short ({len} / 30–60 chars)', { len: titleLen }) },
    { when: metaTitle && titleLen > 60,                            type: 'warning', title: t('Title too long ({len} / 30–60 chars)',  { len: titleLen }) },
    { when: metaTitle && titleLen >= 30 && titleLen <= 60,         type: 'success', title: t('Meta title OK ({len} chars)',           { len: titleLen }) },
  ])

  const descLen = metaDescription.length
  add('meta-desc', t('Meta Description'),
    metaDescription ? t('{len} chars: {snippet}', { len: descLen, snippet: `${metaDescription.slice(0, 55)}${descLen > 55 ? '…' : ''}` }) : '–', 'SEO', [
    { when: !metaDescription,                                      type: 'error',   title: t('No meta description') },
    { when: metaDescription && descLen < 120,                      type: 'warning', title: t('Description too short ({len} / 120–160 chars)', { len: descLen }) },
    { when: metaDescription && descLen > 160,                      type: 'warning', title: t('Description too long ({len} / 120–160 chars)',  { len: descLen }) },
    { when: metaDescription && descLen >= 120 && descLen <= 160,   type: 'success', title: t('Meta description OK ({len} chars)',             { len: descLen }) },
  ])

  add('canonical', 'Canonical', canonical || '–', 'SEO', [
    { when: !canonical,                                            type: 'warning', title: t('No canonical tag') },
    { when: !!canonical,                                           type: 'success', title: t('Canonical tag present') },
  ])

  const ogMissing = [!ogTitle && 'og:title', !ogDescription && 'og:description', !ogImage && 'og:image'].filter(Boolean)
  add('og-tags', 'Open Graph',
    ogMissing.length ? t('Missing: {fields}', { fields: ogMissing.join(', ') }) : 'title, description, image', 'SEO', [
    { when: ogMissing.length > 0,                                  type: 'warning', title: t('OG tags incomplete — missing: {fields}', { fields: ogMissing.join(', ') }) },
    { when: ogMissing.length === 0,                                type: 'success', title: t('Open Graph complete') },
  ])

  add('html-lang', t('Language (lang)'), lang || '–', 'HTML', [
    { when: !lang,                                                 type: 'warning', title: t('lang attribute missing on <html>') },
    { when: !!lang,                                                type: 'success', title: t('Language set: {lang}', { lang }) },
  ])

  add('viewport', t('Viewport meta'), viewport ? t('Present') : '–', 'HTML', [
    { when: !viewport,                                             type: 'warning', title: t('Viewport meta tag missing') },
    { when: !!viewport,                                            type: 'success', title: t('Viewport meta present') },
  ])

  const isDefaultThemeColor = ['#000', '#000000', 'black'].includes(themeColor.trim().toLowerCase())
  add('theme-color', 'Theme-Color', themeColor || '–', 'HTML', [
    { when: !themeColor,                                           type: 'warning', title: t('theme-color meta tag missing') },
    { when: themeColor && isDefaultThemeColor,                     type: 'warning', title: t('theme-color is default "{color}" — should match brand', { color: themeColor }) },
    { when: themeColor && !isDefaultThemeColor,                    type: 'success', title: `theme-color: ${themeColor}` },
  ])

  return finish()
}
