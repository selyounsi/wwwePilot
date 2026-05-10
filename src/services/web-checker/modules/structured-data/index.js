export const overlay = null

export const claude = {
  title: 'Schema.org-Vorschlag',
  systemPrompt:
    'You are a structured-data / schema.org expert. The user found an issue with JSON-LD on a page. ' +
    'Reply in German, briefly:\n' +
    '1. Why this schema matters (rich results, SEO).\n' +
    '2. If a schema is MISSING, suggest a complete JSON-LD snippet that fits the page content (fenced ```json block).\n' +
    '3. If a schema is BROKEN, give the corrected JSON in a fenced ```json block.',
  maxTokens: 1200,
}

export default async function check() {
  const t = window.__t
  const head = document.head

  // Must live inside check() — executeScript serializes only the function body,
  // module scope isn't available in the page context.
  const RICH_RESULT_TYPES = new Set([
    'Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'ScholarlyArticle', 'Report',
    'Book',
    'BreadcrumbList',
    'Course',
    'Dataset',
    'Event', 'BusinessEvent', 'EducationEvent', 'SocialEvent', 'SportsEvent',
    'FAQPage', 'Question', 'QAPage',
    'HowTo',
    'ImageObject',
    'JobPosting',
    'LearningResource',
    'LocalBusiness', 'Restaurant', 'Store', 'Hotel', 'AutoDealer', 'AutoRepair',
    'Bakery', 'Bank', 'Dentist', 'Florist', 'Pharmacy', 'BeautySalon',
    'GeneralContractor', 'HomeAndConstructionBusiness', 'EmploymentAgency',
    'Logo',
    'Movie', 'TVSeries', 'TVEpisode',
    'Organization', 'Corporation', 'EducationalOrganization', 'GovernmentOrganization',
    'NewsMediaOrganization', 'NGO', 'PerformingGroup', 'SportsOrganization', 'OnlineBusiness',
    'Product',
    'Recipe',
    'Review', 'CriticReview', 'UserReview', 'EmployerReview',
    'AggregateRating',
    'Service',
    'SoftwareApplication', 'MobileApplication', 'WebApplication',
    'VideoObject',
    'WebPage', 'WebSite', 'AboutPage', 'CollectionPage', 'ContactPage', 'ItemPage', 'ProfilePage',
  ])

  // Walks the JSON-LD tree, flattening arrays and @graph; nested entities
  // (review[], aggregateRating, ...) become their own items like Google does.
  function collectEntities(node) {
    if (!node) return []
    if (Array.isArray(node)) return node.flatMap(collectEntities)
    if (typeof node !== 'object') return []

    const results = []
    const rawType = node['@type']
    const types   = Array.isArray(rawType) ? rawType : rawType ? [rawType] : []
    if (types.some(t => RICH_RESULT_TYPES.has(t))) results.push(node)

    if (Array.isArray(node['@graph'])) {
      results.push(...node['@graph'].flatMap(collectEntities))
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === '@graph' || key === '@type' || key === '@context' || key === '@id') continue
      results.push(...collectEntities(value))
    }

    return results
  }

  const jsonLdBlocks = []
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { jsonLdBlocks.push(...collectEntities(JSON.parse(s.textContent))) } catch {}
  })

  const { addItem, finish } = createCheckResult()

  // Use <img> probe instead of fetch — works for cross-origin images
  // without CORS headers. naturalWidth/Height are readable either way.
  async function checkSchemaImage(block) {
    const raw = block.image
    if (!raw) return { url: null, reachable: null, width: 0, height: 0 }

    const rawUrl = typeof raw === 'string' ? raw : (raw.url || raw['@id'] || '')
    if (!rawUrl) return { url: null, reachable: null, width: 0, height: 0 }

    let url
    try { url = new URL(rawUrl, document.baseURI).href }
    catch { return { url: rawUrl, reachable: false, width: 0, height: 0 } }

    return new Promise(resolve => {
      const img = new Image()
      img.onload  = () => resolve({ url, reachable: true,  width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ url, reachable: false, width: 0, height: 0 })
      img.src = url
    })
  }

  if (jsonLdBlocks.length === 0) {
    addItem(head, [
      { when: true, type: 'warning', title: t('No structured data (JSON-LD) found') },
    ], { id: 'no-json-ld', name: t('No JSON-LD data'), details: '', category: 'JSON-LD', visible: true, _meta: null })
    return finish()
  }

  // Group by primary @type — one item per type, entities listed in _meta.
  const grouped = new Map()
  for (const block of jsonLdBlocks) {
    const rawType = block['@type']
    const primary = Array.isArray(rawType) ? rawType[0] : rawType
    if (!grouped.has(primary)) grouped.set(primary, [])
    grouped.get(primary).push(block)
  }

  for (const [type, entities] of grouped) {
    const imgInfos = await Promise.all(entities.map(checkSchemaImage))

    const checks = []
    imgInfos.forEach(info => {
      if (!info.url) return
      const filename = info.url.split('/').pop().split('?')[0]
      checks.push({
        when: info.reachable === false,
        type: 'error',
        title: t('Image not reachable: {file}', { file: filename }),
      })
      const isSocialBranding = filename.toLowerCase().includes('social_branding')
      checks.push({
        when: isSocialBranding && info.reachable === true && (info.width < 250 || info.height < 250),
        type: 'error',
        title: t('social_branding too small: {w}×{h}px (min. 250×250)', { w: info.width, h: info.height }),
      })
    })

    addItem(head, checks, {
      id:       `type-${type}`,
      name:     type,
      details:  entities.length === 1 ? t('1 entity') : t('{n} entities', { n: entities.length }),
      category: 'JSON-LD',
      visible:  true,
      _meta: {
        type,
        count:    entities.length,
        entities: entities.map((schema, i) => ({ schema, image: imgInfos[i] })),
      },
    })
  }

  return finish()
}
