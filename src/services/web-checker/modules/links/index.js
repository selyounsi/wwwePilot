export const checkOnReload = true
export const allowChatBot = true
export const overlay = {
  enabled: true,
  labelFn: (item) => item.title ? `Title: ${item.title}` : '⚠ Kein Title',
  onText:  'Titles ausblenden',
  offText: 'Titles einblenden',
}

export default async function check() {

  const IGNORE_SELECTORS = [
    '[href="#content"]',
    '[href="#back-to-top"]',
    '[href="/sitemap"]',
    '.cms-logo',
    '.WidgetSealContainer',
  ]

  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const links = Array.from(document.querySelectorAll('a[href]'))

  if (links.length === 0) {
    errors.push({ message: 'Keine Links gefunden' })
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

  const brokenResults = await new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'CHECK_LINKS', urls: checkableUrls.map(u => u ?? '') },
      results => {
        const map = Object.fromEntries((results ?? []).map(r => [r.url, r.broken]))
        resolve(checkableUrls.map(u => u ? (map[u] ?? false) : false))
      }
    )
  })

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
    const visibleText = linkContent || title || (hasIcon ? '(Icon)' : '')

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
        title:       'Link nicht erreichbar (404)',
        description: href,
      },
      {
        when:        noText,
        type:        'error',
        title:       'Leerer Link',
        description: `href="${href}" hat keinen sichtbaren Text`,
      },
      {
        when:        iconNoLabel,
        type:        'error',
        title:       'Icon-Link ohne aria-label oder title',
        description: `href="${href}" — Screenreader können den Link nicht beschriften`,
      },
      {
        when:        noTitle && !isMailto && !isTel,
        type:        'error',
        title:       'Fehlendes title-Attribut',
        description: `"${visibleText || href}"`,
      },
      {
        when:        titleEqualsText,
        type:        'warning',
        title:       'Title identisch mit Linktext',
        description: `"${title}" – title sollte zusätzliche Info liefern`,
      },
      {
        when:        noBlank,
        type:        'warning',
        title:       'Externer Link ohne target="_blank"',
        description: href,
      },
      {
        when:        noMailTitle,
        type:        'warning',
        title:       isMailto ? 'Mailto ohne title' : 'Tel ohne title',
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
      text:      visibleText || '(leer)',
      title:     title ?? null,
      isExternal,
      isMailto,
      isTel,
      _meta: { tag: 'a', idx: index },
    })
  })

  return finish()
}