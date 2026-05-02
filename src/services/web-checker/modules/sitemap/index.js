export const overlay = null

export default async function check() {
  const t = window.__t
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const reply = await runInBackground('FETCH_SITEMAP', { origin: location.origin })
  if (reply?.error || !reply?.urls?.length) {
    errors.push({ message: t(reply?.error ? 'Sitemap not reachable' : 'No URLs in sitemap') })
    return finish()
  }

  const sitemapUrls = new Set(
    reply.urls.map(u => { try { return new URL(u, location.origin).href.replace(/\/$/, '') } catch { return null } })
              .filter(Boolean),
  )

  const linkedUrls = new Set()
  const linksByUrl = new Map()
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return
    let url
    try { url = new URL(href, location.href) } catch { return }
    if (url.origin !== location.origin) return
    const normalized = url.href.replace(/\/$/, '').split('#')[0]
    linkedUrls.add(normalized)
    if (!linksByUrl.has(normalized)) linksByUrl.set(normalized, a)
  })

  const linkedNotInSitemap = [...linkedUrls].filter(u => !sitemapUrls.has(u))
  const sitemapNotLinked   = [...sitemapUrls].filter(u => !linkedUrls.has(u))
  const both               = [...linkedUrls].filter(u => sitemapUrls.has(u))

  const head = document.head

  linkedNotInSitemap.forEach((url, idx) => {
    const el = linksByUrl.get(url) ?? head
    addItem(el, [
      {
        when:        true,
        type:        'warning',
        title:       t('Linked but not in sitemap'),
        description: t('Page is reachable from this site but missing from the sitemap — search engines may not index it'),
      },
    ], {
      url, name: url, details: t('Linked but not in sitemap'),
      kind: 'linked-only',
      visible: true,
      _meta: { tag: 'A', idx: 0, text: url.split('/').slice(-2).join('/') },
    })
  })

  sitemapNotLinked.forEach((url, idx) => {
    addItem(head, [
      {
        when:        true,
        type:        'error',
        title:       t('Orphan in sitemap'),
        description: t('Listed in sitemap but no internal link found — content is unreachable from navigation'),
      },
    ], {
      url, name: url, details: t('Orphan in sitemap'),
      kind: 'orphan',
      visible: true,
      _meta: { idx: 'orphan-' + idx },
    })
  })

  both.forEach((url, idx) => {
    addItem(head, [
      {
        when:        true,
        type:        'success',
        title:       t('URL OK'),
        description: t('Both linked and in sitemap'),
      },
    ], {
      url, name: url, details: url,
      kind: 'both',
      visible: true,
      _meta: { idx: 'both-' + idx },
    })
  })

  return finish()
}
