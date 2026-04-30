import { API } from '@/config/api.js'

export const overlay   = null
export const apiConfig = { pagespeedUrl: API.pagespeed.url }

export default async function check(config = {}) {
  const t = window.__t

  function formatBytes(bytes) {
    if (!bytes) return '0 B'
    if (bytes < 1024)    return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  let resources = 0, totalBytes = 0, scripts = 0, images = 0, cssFiles = 0
  try {
    const entries = performance.getEntriesByType('resource')
    resources  = entries.length
    totalBytes = entries.reduce((s, r) => s + (r.transferSize || 0), 0)
    scripts    = entries.filter(r => r.initiatorType === 'script').length
    images     = entries.filter(r => r.initiatorType === 'img').length
    cssFiles   = entries.filter(r => r.initiatorType === 'link').length
  } catch {}

  async function fetchPageSpeed(pageUrl) {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?/.test(pageUrl)
    if (isLocal) return { mobile: null, desktop: null, local: true }

    const base = config.pagespeedUrl ?? 'http://localhost:3000/api/pagespeed'

    async function fetchData(strategy) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      try {
        const res = await fetch(
          `${base}?url=${encodeURIComponent(pageUrl)}&strategy=${strategy}`,
          { signal: controller.signal, cache: 'no-store' }
        )
        clearTimeout(timeout)
        if (!res.ok) return null
        const data = await res.json()
        const rawScore = data.lighthouseResult?.categories?.performance?.score
        const audits   = data.lighthouseResult?.audits ?? {}

        const score = rawScore !== undefined && rawScore !== null ? Math.round(rawScore * 100) : null

        const vitals = [
          { key: 'LCP', label: 'Largest Contentful Paint', value: audits['largest-contentful-paint']?.displayValue ?? null, score: audits['largest-contentful-paint']?.score ?? null },
          { key: 'FCP', label: 'First Contentful Paint',   value: audits['first-contentful-paint']?.displayValue  ?? null, score: audits['first-contentful-paint']?.score  ?? null },
          { key: 'TBT', label: 'Total Blocking Time',      value: audits['total-blocking-time']?.displayValue     ?? null, score: audits['total-blocking-time']?.score     ?? null },
          { key: 'CLS', label: 'Cumulative Layout Shift',  value: audits['cumulative-layout-shift']?.displayValue ?? null, score: audits['cumulative-layout-shift']?.score ?? null },
          { key: 'SI',  label: 'Speed Index',              value: audits['speed-index']?.displayValue             ?? null, score: audits['speed-index']?.score             ?? null },
        ].filter(v => v.value !== null)

        const opportunities = Object.entries(audits)
          .filter(([, a]) => a.score !== null && a.score < 0.9 && a.displayValue && a.title &&
            (a.details?.type === 'opportunity' || a.details?.type === 'table' || a.details?.type === 'list'))
          .sort((a, b) => (a[1].score ?? 1) - (b[1].score ?? 1))
          .slice(0, 10)
          .map(([, a]) => ({ title: a.title, score: a.score ?? 1, displayValue: a.displayValue }))

        return { score, vitals, opportunities }
      } catch {
        clearTimeout(timeout)
        return null
      }
    }

    const [mobile, desktop] = await Promise.all([fetchData('mobile'), fetchData('desktop')])
    return { mobile, desktop, local: false }
  }

  const psi = await fetchPageSpeed(document.location.href)

  const { addItem, finish } = createCheckResult()
  const head = document.head

  function add(id, name, details, checks, meta) {
    addItem(head, checks, { id, name, details: details || '', category: 'Performance', visible: true, _meta: meta ?? {} })
  }

  const mob = psi.mobile
  add('psi-mobile', 'PageSpeed Mobile',
    mob?.score !== null && mob?.score !== undefined ? `${mob.score}/100` : '–', [
    { when: psi.local,                                                              type: 'warning', title: t('Not available for local URLs') },
    { when: !psi.local && !mob,                                                     type: 'warning', title: t('Score not retrievable') },
    { when: mob?.score !== null && mob?.score !== undefined && mob.score < 50,      type: 'error',   title: t('{score}/100 — Critical',           { score: mob?.score }) },
    { when: mob?.score !== null && mob?.score !== undefined && mob.score >= 50 && mob.score < 90, type: 'warning', title: t('{score}/100 — Needs improvement', { score: mob?.score }) },
  ], mob ?? {})

  const desk = psi.desktop
  add('psi-desktop', 'PageSpeed Desktop',
    desk?.score !== null && desk?.score !== undefined ? `${desk.score}/100` : '–', [
    { when: psi.local,                                                                type: 'warning', title: t('Not available for local URLs') },
    { when: !psi.local && !desk,                                                      type: 'warning', title: t('Score not retrievable') },
    { when: desk?.score !== null && desk?.score !== undefined && desk.score < 50,     type: 'error',   title: t('{score}/100 — Critical',           { score: desk?.score }) },
    { when: desk?.score !== null && desk?.score !== undefined && desk.score >= 50 && desk.score < 90, type: 'warning', title: t('{score}/100 — Needs improvement', { score: desk?.score }) },
  ], desk ?? {})

  add('resources-total', t('Total resources'), t('{n} files', { n: resources }), [
    { when: resources > 150,                    type: 'error',   title: t('Very many resources ({n} files)', { n: resources }) },
    { when: resources > 80 && resources <= 150, type: 'warning', title: t('Many resources ({n} files)',      { n: resources }) },
    { when: resources <= 80,                    type: 'success', title: t('Resources OK ({n} files)',        { n: resources }) },
  ])

  add('transfer-size', t('Transfer size'), formatBytes(totalBytes), [
    { when: totalBytes > 5 * 1048576,                            type: 'error',   title: t('Very large: {size}',     { size: formatBytes(totalBytes) }) },
    { when: totalBytes > 2 * 1048576 && totalBytes <= 5*1048576, type: 'warning', title: t('Large: {size}',          { size: formatBytes(totalBytes) }) },
    { when: totalBytes <= 2 * 1048576,                           type: 'success', title: t('Transfer size OK: {size}', { size: formatBytes(totalBytes) }) },
  ])

  add('scripts', 'Scripts', t('{n} files', { n: scripts }), [
    { when: scripts > 30,                  type: 'error',   title: t('Very many scripts ({n})', { n: scripts }) },
    { when: scripts > 15 && scripts <= 30, type: 'warning', title: t('Many scripts ({n})',      { n: scripts }) },
    { when: scripts <= 15,                 type: 'success', title: t('Scripts OK ({n})',        { n: scripts }) },
  ])

  add('images', t('Images'), t('{n} files', { n: images }), [
    { when: images > 40,  type: 'warning', title: t('Many images loaded ({n})', { n: images }) },
    { when: images <= 40, type: 'success', title: t('Images OK ({n})',          { n: images }) },
  ])

  add('css', 'Stylesheets', t('{n} files', { n: cssFiles }), [
    { when: cssFiles > 10,  type: 'warning', title: t('Many stylesheet requests ({n})', { n: cssFiles }) },
    { when: cssFiles <= 10, type: 'success', title: t('CSS OK ({n})',                   { n: cssFiles }) },
  ])

  return finish()
}
