export const checkOnReload = true
export const allowChatBot  = true
export const overlay = {
  enabled: true,
  labelFn: (item) => {
    if (item.isBackground) return '⚠ CSS-Hintergrundbild'
    return item.alt !== null ? `Alt: ${item.alt || '(leer)'}` : '⚠ Kein Alt'
  },
  onText:  'Alt ausblenden',
  offText: 'Alt einblenden',
}

export default function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()
  const IMAGE_EXTS = /\.(gif|jpe?g|png|webp|svg|bmp|mp4)(\?.*)?$/i

  // flags inline `background-image` styles and `data-cms-src` on non-img elements
  function checkBackgroundImages() {
    const bgEls  = Array.from(document.querySelectorAll('[style*="background-image"]')).filter(el => el.tagName !== 'IMG')
    const cmsEls = Array.from(document.querySelectorAll('[data-cms-src]:not(img)'))
    const seen   = new Set()
    const all    = [...bgEls, ...cmsEls].filter(el => seen.has(el) ? false : (seen.add(el), true))

    all.forEach((el, idx) => {
      const cmsSrc  = el.getAttribute('data-cms-src') || ''
      const bgMatch = (el.style.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/)
      const bgUrl   = bgMatch?.[1] || ''
      const rawSrc  = cmsSrc || bgUrl
      const src     = rawSrc ? new URL(rawSrc, document.baseURI).href : ''
      const name    = src ? src.split('/').pop().split('?')[0] || 'Unbekannt' : el.className || el.tagName.toLowerCase()

      addItem(el, [
        { when: !!bgUrl,            type: 'error', title: 'Bild als CSS-Hintergrundbild eingebunden' },
        { when: !bgUrl && !!cmsSrc, type: 'error', title: 'data-cms-src auf Nicht-Bild-Element' },
      ], { src, name, alt: null, width: 0, height: 0, broken: false, isBackground: true, _meta: { src: rawSrc, name, alt: null, isBackground: true, idx } })
    })
  }

  // alt-text + lightbox check folded into a single item per <img> to avoid duplicates
  function checkImages() {
    const BLACKLIST      = ['shutterstock', 'gettyimages', 'istock', 'screenshot', 'depositphotos', 'adobe-stock', 'dreamstime']
    const processedLinks = new Set()
    const images         = Array.from(document.querySelectorAll('img'))

    images.forEach(img => {
      const alt     = img.getAttribute('alt')
      const rawSrc  = img.getAttribute('data-pic-cms-src') || img.getAttribute('data-src') || img.getAttribute('src') || ''
      const src     = rawSrc ? new URL(rawSrc, document.baseURI).href : ''
      const name    = rawSrc.split('/').pop().split('?')[0] || 'Unbekannt'
      const isLazy  = (img.getAttribute('data-pic-cms-src') || img.getAttribute('data-src')) && img.src !== src
      const broken  = !isLazy && !img.naturalWidth && img.complete
      const width   = img.naturalWidth
      const height  = img.naturalHeight
      const renderedWidth  = img.clientWidth
      const renderedHeight = img.clientHeight
      // skip upscale check for vector formats — they scale losslessly
      const isVector = /\.svg(\?|#|$)/i.test(rawSrc)
      const isUpscaled = !isVector && !broken && !isLazy
        && width > 0 && height > 0
        && renderedWidth > 0 && renderedHeight > 0
        && (renderedWidth - width > 2 || renderedHeight - height > 2)

      const blacklistMatch = BLACKLIST.find(w => name.toLowerCase().includes(w))
      const nameWithoutExt = name.replace(/\.[^.]+$/, '')
      const altNorm   = (alt ?? '').toLowerCase().replace(/[-_\s]/g, '')
      const nameNorm  = nameWithoutExt.toLowerCase().replace(/[-_\s]/g, '')
      const isAutoAlt = alt !== null && (
        altNorm === nameNorm
        || /^[a-z0-9_-]{10,}$/.test(alt.trim())
        || /[a-f0-9]{8,}/i.test(alt)
        || /(resized|large|small|medium|_x[12]_)/i.test(alt)
      )

      let inLightbox = false, lightboxOk = true
      const parentLink = img.closest('a[href]')
      if (parentLink && parentLink.closest('.cms-image')) {
        const hrefAttr = parentLink.getAttribute('href') || ''
        if (IMAGE_EXTS.test(hrefAttr)) {
          inLightbox = true
          processedLinks.add(parentLink)
          // BaguetteBox checks the gallery container, not the link itself
          const galleryEl = parentLink.closest('.cms-image')
          lightboxOk = !!(
            galleryEl?.classList.contains('lightbox-zoom-image') ||
            galleryEl?.hasAttribute('data-lightbox-type')
          )
        }
      }

      addItem(img, [
        { when: broken,                                type: 'error',   title: 'Bild nicht ladbar' },
        { when: !!blacklistMatch,                      type: 'error',   title: `Dateiname nicht erlaubt: "${blacklistMatch}"` },
        { when: alt === null,                          type: 'error',   title: 'Fehlendes Alt-Attribut' },
        { when: alt !== null && alt.trim().length < 3, type: 'warning', title: `Alt-Text zu kurz: "${alt}"` },
        { when: isAutoAlt,                             type: 'error',   title: `Alt-Text automatisch gesetzt: "${alt}"` },
        { when: inLightbox && !lightboxOk,             type: 'error',   title: 'Lightbox-Klasse fehlt (lightbox-zoom-image)' },
        { when: isUpscaled,                            type: 'warning', title: `Bild wird hochskaliert: ${renderedWidth}×${renderedHeight}px gerendert, Original ${width}×${height}px` },
        { when: true,                                  type: 'success', title: 'Bild korrekt' },
      ], { src, name, alt, width, height, renderedWidth, renderedHeight, isVector, broken, _meta: { src: rawSrc, name, alt } })
    })

    return processedLinks
  }

  // links to image files that contain no <img> (skipped by checkImages)
  function checkOrphanLightboxLinks(processedLinks) {
    const links = Array.from(document.querySelectorAll('.cms-image a[href]'))

    links.forEach(link => {
      if (processedLinks.has(link)) return
      const hrefAttr = link.getAttribute('href') || ''
      if (!IMAGE_EXTS.test(hrefAttr)) return

      const galleryEl  = link.closest('.cms-image')
      const lightboxOk = !!(
        galleryEl?.classList.contains('lightbox-zoom-image') ||
        galleryEl?.hasAttribute('data-lightbox-type')
      )
      const src  = link.href
      const name = hrefAttr.split('/').pop().split('?')[0] || 'Lightbox'
      const alt  = link.getAttribute('aria-label') || ''

      addItem(link, [
        { when: !lightboxOk, type: 'error',   title: 'Lightbox-Klasse fehlt (lightbox-zoom-image)' },
        { when: lightboxOk,  type: 'success', title: 'Lightbox korrekt konfiguriert' },
      ], { src, name, alt, width: 0, height: 0, broken: false, isLightbox: true, _meta: { src, name, alt: null } })
    })
  }

  const hasAnyImage = !!(
    document.querySelector('img') ||
    document.querySelector('[style*="background-image"]') ||
    document.querySelector('[data-cms-src]:not(img)')
  )

  if (!hasAnyImage) {
    errors.push({ message: 'Keine Bilder gefunden' })
    return finish()
  }

  checkBackgroundImages()
  const processedLinks = checkImages()
  checkOrphanLightboxLinks(processedLinks)

  return finish()
}
