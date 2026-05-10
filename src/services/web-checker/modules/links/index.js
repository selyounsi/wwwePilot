import { useI18n } from '@/composables/i18n/useI18n.js'

const { t: tSidebar } = useI18n()

export const overlay = {
  enabled: true,
  labelFn: (item) => item.title
    ? `${tSidebar('Title')}: ${item.title}`
    : `⚠ ${tSidebar('No title')}`,
  onText:  'Hide titles',
  offText: 'Show titles',
}

export const claude = {
  title: 'Link-Verbesserung',
  systemPrompt:
    'You are a UX writer. The user found a link issue on a page. Reply in German, briefly:\n' +
    '1. Why this matters (accessibility for screen readers + SEO).\n' +
    '2. If the link text is vague ("hier", "mehr", "klicke"), suggest 2-3 BETTER alternatives that describe the destination.\n' +
    '3. If the link is broken (404), suggest where the page might have moved or a sensible replacement.',
}

export default async function check() {

  // module-specific anchors stay here; .WidgetSealContainer + general
  // third-party widgets live in Settings → window.__ignoreSelectors
  const IGNORE_SELECTORS = [
    '[href="#content"]',
    '[href="#back-to-top"]',
    '[href="/sitemap"]',
    '.cms-logo',
    ...(window.__ignoreSelectors ?? []),
  ]

  const { errors, warnings, items, addItem, finish } = createCheckResult()
  const t = window.__t

  const links = Array.from(document.querySelectorAll('a[href]'))

  if (links.length === 0) {
    errors.push({ message: t('No links found') })
    return finish()
  }

  const ignored = links.map(a => IGNORE_SELECTORS.some(sel => a.closest(sel)))

  const checkableUrls = links.map((a, i) => {
    if (ignored[i]) return null
    const href = a.getAttribute('href') ?? ''
    if (!href || href.startsWith('#')) return null
    try {
      const url = new URL(href, location.href)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
      return url.href
    } catch { return null }
  })

  const linkResults = await runInBackground('CHECK_LINKS', { urls: checkableUrls.map(u => u ?? '') })
  const brokenMap   = Object.fromEntries((linkResults ?? []).map(r => [r.url, r.broken]))
  const brokenResults = checkableUrls.map(u => u ? (brokenMap[u] ?? false) : false)

  links.forEach((a, index) => {
    if (ignored[index]) return
    const href   = a.getAttribute('href') ?? ''

    const title  = a.getAttribute('title')
    const target = a.getAttribute('target') ?? ''
    const text   = (a.innerText || a.textContent || '').trim()

    const isExternal = href.startsWith('http') && !href.includes(location.hostname)
    const isMailto   = href.startsWith('mailto:')
    const isTel      = href.startsWith('tel:')
    const isAnchor   = href.startsWith('#')

    const ariaLabel   = a.getAttribute('aria-label') ?? ''
    const imgAlt      = a.querySelector('img')?.getAttribute('alt') ?? ''
    const linkContent = text || imgAlt || ariaLabel
    const hasIcon     = !linkContent && hasVisualContent(a)
    const visibleText = linkContent || title || (hasIcon ? `(${t('Icon')})` : '')

    const noText         = !linkContent && !hasIcon
    const iconNoLabel    = hasIcon && !title && !ariaLabel
    const noTitle        = !title && !isAnchor && !hasIcon
    const noBlank        = isExternal && target !== '_blank'
    const noMailTitle    = (isMailto || isTel) && !title
    const isBroken       = brokenResults[index]
    const titleEqualsText = title && linkContent &&
      title.trim().toLowerCase() === linkContent.trim().toLowerCase()

    addItem(a, [
      {
        when:        isBroken,
        type:        'error',
        title:       t('Link unreachable (404)'),
        description: href,
      },
      {
        when:        noText,
        type:        'error',
        title:       t('Empty link'),
        description: t('href="{href}" has no visible text', { href }),
      },
      {
        when:        iconNoLabel,
        type:        'error',
        title:       t('Icon link without aria-label or title'),
        description: t('href="{href}" — screen readers cannot label this link', { href }),
      },
      {
        when:        noTitle && !isMailto && !isTel,
        type:        'error',
        title:       t('Missing title attribute'),
        description: `"${visibleText || href}"`,
      },
      {
        when:        titleEqualsText,
        type:        'warning',
        title:       t('Title identical to link text'),
        description: t('"{title}" — title should provide additional info', { title }),
      },
      {
        when:        noBlank,
        type:        'warning',
        title:       t('External link without target="_blank"'),
        description: href,
      },
      {
        when:        noMailTitle,
        type:        'warning',
        title:       isMailto ? t('Mailto without title') : t('Tel without title'),
        description: href,
      },
      {
        when:        true,
        type:        'success',
        title:       visibleText || href,
        description: href,
      },
    ], {
      href,
      text:      visibleText || `(${t('empty')})`,
      title:     title ?? null,
      isExternal,
      isMailto,
      isTel,
      _meta: { tag: 'a', idx: index },
    })
  })

  return finish()
}
