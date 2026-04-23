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

  // ── 1. Background-Bilder ─────────────────────────────────────────
  // Fehler: Bild per CSS background-image eingebunden (inline style)
  // Fehler: data-cms-src auf einem Nicht-<img>-Element (div-Container)
  function checkBackgroundImages() {
    const bgEls  = Array.from(document.querySelectorAll('[style*="background-image"]')).filter(el => el.tagName !== 'IMG')
    const cmsEls = Array.from(document.querySelectorAll('[data-cms-src]:not(img)'))
    const seen   = new Set()
    const all    = [...bgEls, ...cmsEls].filter(el => seen.has(el) ? false : (seen.add(el), true))

    all.forEach(el => {
      const cmsSrc  = el.getAttribute('data-cms-src') || ''
      const bgMatch = (el.style.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/)
      const bgUrl   = bgMatch?.[1] || ''
      const src     = cmsSrc || bgUrl
      const name    = src ? src.split('/').pop().split('?')[0] || 'Unbekannt' : el.className || el.tagName.toLowerCase()

      addItem(el, [
        { when: !!bgUrl,            type: 'error', title: 'Bild als CSS-Hintergrundbild eingebunden' },
        { when: !bgUrl && !!cmsSrc, type: 'error', title: 'data-cms-src auf Nicht-Bild-Element' },
      ], { src, name, alt: null, width: 0, height: 0, broken: false, isBackground: true, _meta: { src, name, alt: null } })
    })
  }

  // ── 2. Alt-Text + Lightbox (zusammengeführt am <img>) ────────────
  // Lightbox-Check wird direkt am <img> mitgeprüft wenn das Bild
  // innerhalb eines .cms-image a[href=Bilddatei] liegt.
  // → Ein ModuleItem pro Bild, keine Doppelung mehr.
  //
  // Lightbox-Regel: Zuerst prüfen ob der <a>-Link selbst die Klasse/
  // das Attribut hat, wenn nicht → direktes Elternelement prüfen.
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

      // Lightbox: nächstes <a href> das innerhalb .cms-image liegt
      let inLightbox = false, lightboxOk = true
      const parentLink = img.closest('a[href]')
      if (parentLink && parentLink.closest('.cms-image')) {
        const hrefAttr = parentLink.getAttribute('href') || ''
        if (IMAGE_EXTS.test(hrefAttr)) {
          inLightbox = true
          processedLinks.add(parentLink)
          // Der .cms-image-Container muss lightbox-zoom-image haben,
          // nicht der Link selbst (BaguetteBox sucht am Gallery-Container)
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
        { when: true,                                  type: 'success', title: 'Bild korrekt' },
      ], { src, name, alt, width, height, broken, _meta: { src: rawSrc, name, alt } })
    })

    return processedLinks
  }

  // ── 3. Lightbox-Links ohne <img> (Sonderfall) ────────────────────
  // Links auf Bilddateien die kein <img> enthalten und damit nicht
  // über checkImages() erfasst wurden.
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

  // ── Ausführen ─────────────────────────────────────────────────────
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
