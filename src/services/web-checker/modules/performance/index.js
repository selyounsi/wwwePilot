import { API } from '@/config/api.js'

export const checkOnReload = false
export const allowChatBot  = false
export const overlay       = null
export const apiConfig     = { pagespeedUrl: API.pagespeed.url }

export default async function check(config = {}) {

  function formatBytes(bytes) {
    if (!bytes) return '0 B'
    if (bytes < 1024)    return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  // ── 1. Lokale Ressourcen-Statistiken ──────────────────────────────
  let resources = 0, totalBytes = 0, scripts = 0, images = 0, cssFiles = 0
  try {
    const entries = performance.getEntriesByType('resource')
    resources  = entries.length
    totalBytes = entries.reduce((s, r) => s + (r.transferSize || 0), 0)
    scripts    = entries.filter(r => r.initiatorType === 'script').length
    images     = entries.filter(r => r.initiatorType === 'img').length
    cssFiles   = entries.filter(r => r.initiatorType === 'link').length
  } catch {}

  // ── 2. PageSpeed Insights ─────────────────────────────────────────
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

  // ── Checks zusammenstellen ────────────────────────────────────────
  const { addItem, finish } = createCheckResult()
  const head = document.head

  function add(id, name, details, checks, meta) {
    addItem(head, checks, { id, name, details: details || '', category: 'Performance', visible: true, _meta: meta ?? {} })
  }

  // ── PageSpeed Mobile ──────────────────────────────────────────────
  const mob = psi.mobile
  add('psi-mobile', 'PageSpeed Mobile',
    mob?.score !== null && mob?.score !== undefined ? `${mob.score}/100` : '–', [
    { when: psi.local,                                                              type: 'warning', title: 'Nicht verfügbar für lokale URLs' },
    { when: !psi.local && !mob,                                                     type: 'warning', title: 'Score nicht abrufbar' },
    { when: mob?.score !== null && mob?.score !== undefined && mob.score < 50,      type: 'error',   title: `${mob.score}/100 – Kritisch` },
    { when: mob?.score !== null && mob?.score !== undefined && mob.score >= 50 && mob.score < 90, type: 'warning', title: `${mob.score}/100 – Optimierungsbedarf` },
  ], mob ?? {})

  // ── PageSpeed Desktop ─────────────────────────────────────────────
  const desk = psi.desktop
  add('psi-desktop', 'PageSpeed Desktop',
    desk?.score !== null && desk?.score !== undefined ? `${desk.score}/100` : '–', [
    { when: psi.local,                                                                type: 'warning', title: 'Nicht verfügbar für lokale URLs' },
    { when: !psi.local && !desk,                                                      type: 'warning', title: 'Score nicht abrufbar' },
    { when: desk?.score !== null && desk?.score !== undefined && desk.score < 50,     type: 'error',   title: `${desk.score}/100 – Kritisch` },
    { when: desk?.score !== null && desk?.score !== undefined && desk.score >= 50 && desk.score < 90, type: 'warning', title: `${desk.score}/100 – Optimierungsbedarf` },
  ], desk ?? {})

  // ── Lokale Ressourcen ─────────────────────────────────────────────
  add('resources-total', 'Ressourcen gesamt', `${resources} Dateien`, [
    { when: resources > 150,                    type: 'error',   title: `Sehr viele Ressourcen (${resources} Dateien)` },
    { when: resources > 80 && resources <= 150, type: 'warning', title: `Viele Ressourcen (${resources} Dateien)` },
    { when: resources <= 80,                    type: 'success', title: `Ressourcen OK (${resources} Dateien)` },
  ])

  add('transfer-size', 'Transfergröße', formatBytes(totalBytes), [
    { when: totalBytes > 5 * 1048576,                            type: 'error',   title: `Sehr groß: ${formatBytes(totalBytes)}` },
    { when: totalBytes > 2 * 1048576 && totalBytes <= 5*1048576, type: 'warning', title: `Groß: ${formatBytes(totalBytes)}` },
    { when: totalBytes <= 2 * 1048576,                           type: 'success', title: `Transfergröße OK: ${formatBytes(totalBytes)}` },
  ])

  add('scripts', 'Scripts', `${scripts} Dateien`, [
    { when: scripts > 30,                  type: 'error',   title: `Sehr viele Scripts (${scripts})` },
    { when: scripts > 15 && scripts <= 30, type: 'warning', title: `Viele Scripts (${scripts})` },
    { when: scripts <= 15,                 type: 'success', title: `Scripts OK (${scripts})` },
  ])

  add('images', 'Bilder', `${images} Dateien`, [
    { when: images > 40,  type: 'warning', title: `Viele Bilder geladen (${images})` },
    { when: images <= 40, type: 'success', title: `Bilder OK (${images})` },
  ])

  add('css', 'Stylesheets', `${cssFiles} Dateien`, [
    { when: cssFiles > 10,  type: 'warning', title: `Viele Stylesheet-Anfragen (${cssFiles})` },
    { when: cssFiles <= 10, type: 'success', title: `CSS OK (${cssFiles})` },
  ])

  return finish()
}
