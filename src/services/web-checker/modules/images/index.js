import { useI18n } from '@/composables/i18n/useI18n.js'

const { t: tSidebar } = useI18n()

export const overlay = {
  enabled: true,
  labelFn: (item) => {
    if (item.isBackground) return `⚠ ${tSidebar('CSS background image')}`
    return item.alt !== null
      ? `${tSidebar('Alt')}: ${item.alt || tSidebar('(empty)')}`
      : `⚠ ${tSidebar('No alt')}`
  },
  onText:  'Hide alt',
  offText: 'Show alt',
}

export const claude = {
  title: 'Bild-Tipp',
  systemPrompt:
    'You are a web content expert. The user found an image issue on a page (missing/poor alt text, oversized, wrong format, etc.). ' +
    'Reply in German, briefly:\n' +
    '1. What is the problem in plain terms.\n' +
    '2. CONCRETE FIX — if it is an alt-text issue, suggest a 5-15 word alt text in quotes; ' +
    'if file size / format, suggest concrete optimization (WebP, dimensions, lazy loading).',
}

export default function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()
  const t = window.__t
  const IMAGE_EXTS = /\.(gif|jpe?g|png|webp|svg|bmp|mp4)(\?.*)?$/i

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
      const name    = src ? src.split('/').pop().split('?')[0] || t('Unknown') : el.className || el.tagName.toLowerCase()

      addItem(el, [
        { when: !!bgUrl,            type: 'error', title: t('Image used as CSS background') },
        { when: !bgUrl && !!cmsSrc, type: 'error', title: t('data-cms-src on non-image element') },
      ], { src, name, alt: null, width: 0, height: 0, broken: false, isBackground: true, _meta: { src: rawSrc, name, alt: null, isBackground: true, idx } })
    })
  }

  function checkImages() {
    const BLACKLIST      = ['shutterstock', 'gettyimages', 'istock', 'screenshot', 'depositphotos', 'adobe-stock', 'dreamstime']
    const processedLinks = new Set()
    const images         = Array.from(document.querySelectorAll('img'))

    images.forEach((img, idx) => {
      const alt     = img.getAttribute('alt')
      const lazySrc = img.getAttribute('data-cms-src')
                   || img.getAttribute('data-pic-cms-src')
                   || img.getAttribute('data-src')
                   || ''
      const elemSrc = img.getAttribute('src') || ''
      const isPlaceholder = elemSrc.startsWith('data:')
      const rawSrc  = lazySrc || elemSrc
      const src     = rawSrc ? new URL(rawSrc, document.baseURI).href : ''
      const name    = rawSrc ? (rawSrc.split('/').pop().split('?')[0] || t('Unknown')) : t('Unknown')
      const isLazy  = !!lazySrc && (isPlaceholder || img.src !== src)
      const broken  = !isLazy && !isPlaceholder && img.complete && !img.naturalWidth
      const intendedW = parseInt(img.getAttribute('width')  || '0', 10) || 0
      const intendedH = parseInt(img.getAttribute('height') || '0', 10) || 0
      const width   = isLazy ? intendedW : img.naturalWidth
      const height  = isLazy ? intendedH : img.naturalHeight
      const renderedWidth  = img.clientWidth
      const renderedHeight = img.clientHeight
      const isVector = /\.svg(\?|#|$)/i.test(rawSrc)
      const isUpscaled = !isVector && !isLazy && !broken
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
          const galleryEl = parentLink.closest('.cms-image')
          lightboxOk = !!(
            galleryEl?.classList.contains('lightbox-zoom-image') ||
            galleryEl?.hasAttribute('data-lightbox-type') ||
            parentLink.querySelector('img.lightbox-zoom-image') ||
            parentLink.classList.contains('lightbox-zoom-image') ||
            parentLink.closest('.modalGallery')
          )
        }
      }

      addItem(img, [
        { when: broken,                                type: 'error',   title: t('Image cannot load') },
        { when: !!blacklistMatch,                      type: 'error',   title: t('Disallowed filename: "{name}"', { name: blacklistMatch }) },
        { when: alt === null,                          type: 'error',   title: t('Missing alt attribute') },
        { when: alt !== null && alt.trim().length < 3, type: 'warning', title: t('Alt text too short: "{alt}"', { alt }) },
        { when: isAutoAlt,                             type: 'error',   title: t('Auto-generated alt text: "{alt}"', { alt }) },
        { when: inLightbox && !lightboxOk,             type: 'error',   title: t('Lightbox class missing (lightbox-zoom-image)') },
        { when: isUpscaled,                            type: 'warning', title: t('Image upscaled: rendered {rw}×{rh}px, original {w}×{h}px', { rw: renderedWidth, rh: renderedHeight, w: width, h: height }) },
        { when: true,                                  type: 'success', title: t('Image OK') },
      ], { src, name, alt, width, height, renderedWidth, renderedHeight, isVector, broken, isLazy, _meta: { src: rawSrc, name, alt, tag: 'img', idx } })
    })

    return processedLinks
  }

  function checkOrphanLightboxLinks(processedLinks) {
    const allLinks = Array.from(document.querySelectorAll('a'))
    const links    = Array.from(document.querySelectorAll('.cms-image a[href]'))

    links.forEach(link => {
      if (processedLinks.has(link)) return
      const hrefAttr = link.getAttribute('href') || ''
      if (!IMAGE_EXTS.test(hrefAttr)) return

      const galleryEl  = link.closest('.cms-image')
      const lightboxOk = !!(
        galleryEl?.classList.contains('lightbox-zoom-image') ||
        galleryEl?.hasAttribute('data-lightbox-type') ||
        link.classList.contains('lightbox-zoom-image') ||
        link.closest('.modalGallery')
      )
      const src  = link.href
      const name = hrefAttr.split('/').pop().split('?')[0] || 'Lightbox'
      const alt  = link.getAttribute('aria-label') || ''

      addItem(link, [
        { when: !lightboxOk, type: 'error',   title: t('Lightbox class missing (lightbox-zoom-image)') },
        { when: lightboxOk,  type: 'success', title: t('Lightbox correctly configured') },
      ], { src, name, alt, width: 0, height: 0, broken: false, isLightbox: true, _meta: { src, name, alt: null, tag: 'a', idx: allLinks.indexOf(link) } })
    })
  }

  const hasAnyImage = !!(
    document.querySelector('img') ||
    document.querySelector('[style*="background-image"]') ||
    document.querySelector('[data-cms-src]:not(img)')
  )

  if (!hasAnyImage) {
    errors.push({ message: t('No images found') })
    return finish()
  }

  checkBackgroundImages()
  const processedLinks = checkImages()
  checkOrphanLightboxLinks(processedLinks)

  return finish()
}
