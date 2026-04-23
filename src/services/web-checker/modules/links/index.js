export const checkOnReload = true
export const allowChatBot = true
export const overlay = {
  enabled: true,
  labelFn: (item) => item.title ? `Title: ${item.title}` : '⚠ Kein Title',
  onText:  'Titles ausblenden',
  offText: 'Titles einblenden',
}

export default async function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const links = Array.from(document.querySelectorAll('a[href]'))

  if (links.length === 0) {
    errors.push({ message: 'Keine Links gefunden' })
    return finish()
  }

  const checkableUrls = links.map(a => {
    const href = a.getAttribute('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
    try { return new URL(href, location.href).href } catch { return null }
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

  const IGNORE_LINKS = [
    // '/datenschutz',
    // 'https://example.com',
  ]

  links.forEach((a, index) => {
    const href   = a.getAttribute('href') ?? ''
    if (IGNORE_LINKS.some(ignore => href.includes(ignore))) return

    const title  = a.getAttribute('title')
    const target = a.getAttribute('target') ?? ''
    const text   = (a.innerText || a.textContent || '').trim()

    const isExternal = href.startsWith('http') && !href.includes(location.hostname)
    const isMailto   = href.startsWith('mailto:')
    const isTel      = href.startsWith('tel:')
    const isAnchor   = href.startsWith('#')

    const ariaLabel   = a.getAttribute('aria-label') ?? ''
    const imgAlt      = a.querySelector('img')?.getAttribute('alt') ?? ''
    const visibleText = text || imgAlt || ariaLabel || title || ''

    const noText         = !visibleText
    const noTitle        = !title && !isAnchor
    const noBlank        = isExternal && target !== '_blank'
    const noMailTitle    = (isMailto || isTel) && !title
    const isBroken       = brokenResults[index]
    const titleEqualsText = title && visibleText &&
      title.trim().toLowerCase() === visibleText.trim().toLowerCase()

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