export const overlay = {
  enabled: true,
  labelFn: (item) => item.service ? `${item.kind} – ${item.service}` : item.kind,
  onText:  'Hide tracking',
  offText: 'Show tracking',
}

export default async function check() {
  const t = window.__t
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const templates = window.pCServiceTemplates ?? {}
  const pcVersion = window.privacyControl?.version ?? window.PrivacyControl?.version ?? null

  const HOST_TO_SERVICE = [
    [/(^|\.)google\.com$/i,                 'googlemaps', url => /\/maps\//.test(url)],
    [/(^|\.)youtube(-nocookie)?\.com$/i,    'youtube',    () => true],
    [/(^|\.)youtu\.be$/i,                   'youtube',    () => true],
    [/(^|\.)autoscout24\.(de|com|at|ch)$/i, 'autoscout',  () => true],
    [/(^|\.)mobile\.de$/i,                  'mobilede',   () => true],
    [/(^|\.)immobilienscout24\.de$/i,       'immoscout',  () => true],
    [/(^|\.)curator\.io$/i,                 'curator',    () => true],
    [/(^|\.)googletagmanager\.com$/i,       'gtag_gtm',   url => /\/gtm\.js/.test(url)],
    [/(^|\.)googletagmanager\.com$/i,       'gtag_g',     url => /\/gtag\/js/.test(url)],
    [/(^|\.)google-analytics\.com$/i,       'gtag_g',     () => true],
    [/(^|\.)googleadservices\.com$/i,       'gtag_aw',    () => true],
    [/(^|\.)googlesyndication\.com$/i,      'gtag_aw',    () => true],
    [/(^|\.)doubleclick\.net$/i,            'gtag_aw',    () => true],
  ]

  const IGNORED_HOST_PATTERNS = [/meinebewertungen/i]

  function classifyHost(url) {
    let host = ''
    try { host = new URL(url, location.href).hostname } catch { return null }
    if (!host) return null
    if (host === location.hostname) return { host, service: null, sameOrigin: true }
    if (IGNORED_HOST_PATTERNS.some(rx => rx.test(host) || rx.test(url))) return null
    for (const [rx, service, predicate] of HOST_TO_SERVICE) {
      if (rx.test(host) && predicate(url)) return { host, service, sameOrigin: false }
    }
    return { host, service: null, sameOrigin: false }
  }

  function isLocalPlaceholder(url) {
    if (!url) return false
    return /privacyControl[^/]*placeholder/i.test(url)
        || /\/privacyControl\/.*\/placeholder\//i.test(url)
        || /\/_modules\/privacyControl\//i.test(url)
  }

  function iframeMasked(el) {
    if (el.hasAttribute('data-iframe')) return true
    if (el.hasAttribute('data-src'))    return true
    const src = el.getAttribute('src') || ''
    return isLocalPlaceholder(src)
  }

  function scriptMasked(el) {
    if (el.hasAttribute('data-script')) return true
    if (el.hasAttribute('data-src'))    return true
    const type = el.getAttribute('type') || ''
    if (type && type !== 'text/javascript' && type !== 'module' && type !== 'application/json' && type !== 'application/ld+json') return true
    return false
  }

  function imgMasked(el) {
    if (el.hasAttribute('data-img')) return true
    if (el.hasAttribute('data-src')) return true
    const src = el.getAttribute('src') || ''
    return isLocalPlaceholder(src)
  }

  function consentFor(service) {
    if (!service) return null
    return window.consent?.[service] === true
  }

  function effectiveSrc(el) {
    return el.getAttribute('data-src') || el.getAttribute('src') || ''
  }

  const declaredService = (el) =>
    el.getAttribute('data-iframe') ||
    el.getAttribute('data-script') ||
    el.getAttribute('data-img')    || null

  function evaluate(el, kind, mask) {
    const declared   = declaredService(el)
    const realUrl    = effectiveSrc(el)
    const cls        = classifyHost(realUrl)
    const isExternal = cls && !cls.sameOrigin

    if (!isExternal && !declared) return

    const service     = declared || cls?.service || null
    const tpl         = service ? templates[service] : null
    const serviceName = tpl?.name || service || t('unknown')
    const provider    = tpl?.provider || null
    const expectedTag = tpl?.type ? tpl.type.toUpperCase() : null
    const host        = isExternal ? cls.host : (location.hostname + ' (placeholder)')
    const masked      = mask(el)
    const consent     = consentFor(service)
    const tagIdx      = Array.from(document.querySelectorAll(el.tagName)).indexOf(el)
    const kindLabel   = { iframe: 'IFRAME', script: 'SCRIPT', image: 'IMG' }[kind] ?? kind.toUpperCase()
    const extra       = {
      kind, host, service, serviceName, provider, masked, consent,
      name:    `[${kindLabel}] ${serviceName} — ${host}`,
      details: provider || host,
      ...(kind === 'script' ? { visible: true } : {}),
      _meta: { tag: el.tagName, idx: tagIdx },
    }

    if (declared && !tpl) {
      addItem(el, [
        { when: true, type: 'warning', title: t('Unknown service "{service}" — not in pCServiceTemplates', { service }),
          description: t('Service-Key ist deklariert aber im privacyControl-Config nicht definiert') },
      ], extra)
      return
    }

    if (declared && expectedTag && el.tagName !== expectedTag && kind === 'iframe' && tpl?.type === 'script') {
      addItem(el, [
        { when: true, type: 'warning', title: t('Type mismatch for "{service}"', { service: serviceName }),
          description: t('Template erwartet {expected}, gefunden {found}', { expected: tpl.type, found: kind }) },
      ], extra)
      return
    }

    if (masked) {
      const description = consent
        ? t('Loaded after consent for {service}', { service: serviceName })
        : t('Properly masked, waiting for consent ({service})', { service: serviceName })
      addItem(el, [
        { when: true, type: 'success', title: t('Masked {kind} ({service})', { kind: t(kind), service: serviceName }), description },
      ], extra)
      return
    }

    addItem(el, [
      { when: true, type: 'error', title: t('Unmasked {kind} from {host}', { kind: t(kind), host }),
        description: t('Element is not gated by privacyControl — cookies load on every visit, before any consent. Add data-iframe/data-script/data-img.') },
    ], extra)
  }

  document.querySelectorAll('iframe').forEach(el => evaluate(el, 'iframe', iframeMasked))
  document.querySelectorAll('script[src], script[data-src]').forEach(el => evaluate(el, 'script', scriptMasked))
  document.querySelectorAll('img[src], img[data-src]').forEach(el => evaluate(el, 'image',  imgMasked))

  const anyUnmasked = items.some(i => i.kind && !i.masked && !i.consent)
  if (anyUnmasked && !window.cms?.hasPrivacyControl) {
    warnings.unshift({ message: t('privacyControl is not present on this page — tracking elements cannot be masked') })
  }

  return finish()
}
