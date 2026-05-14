import { useI18n } from '@/composables/i18n/useI18n.js'

const { t: tSidebar } = useI18n()

export const overlay = {
  enabled: true,
  labelFn: (item) => `${item.ratio}:1 – ${tSidebar(item.level)}`,
  onText:  'Hide contrast',
  offText: 'Show contrast',
}

export const claude = {
  title: 'Kontrast-Vorschlag',
  systemPrompt:
    'You are a brand designer and accessibility expert. The user found a contrast issue between a foreground and background color. ' +
    'Reply in German, briefly (2-3 paragraphs):\n' +
    '1. Why this contrast matters (WCAG AA: 4.5:1 for normal text, 3:1 for large).\n' +
    '2. Suggest a SPECIFIC HEX COLOR for the foreground that passes WCAG AA and stays close to the original ' +
    '(e.g. a slightly darker/lighter variant). Show it in a fenced ```text block (just the hex).',
}

export default async function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()
  const t = window.__t

  const contrastClass = window.accessibility?.settings?.services?.contrast?.config?.htmlClass ?? null
  let activatedByUs   = false

  if (contrastClass && !document.documentElement.classList.contains(contrastClass)) {
    document.documentElement.classList.add(contrastClass)
    activatedByUs = true
    await new Promise(r => setTimeout(r, 500))
  }

  function parseColor(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
    if (!m) return null
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 }
  }

  function luminance({ r, g, b }) {
    return [r, g, b].reduce((sum, c, i) => {
      const s = c / 255
      const l = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      return sum + l * [0.2126, 0.7152, 0.0722][i]
    }, 0)
  }

  function contrastRatio(c1, c2) {
    const l1 = luminance(c1), l2 = luminance(c2)
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2)
  }

  function toHex({ r, g, b }) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
  }

  function premultiply(fg, bg) {
    const a = fg.a ?? 1
    return {
      r: Math.round(fg.r * a + bg.r * (1 - a)),
      g: Math.round(fg.g * a + bg.g * (1 - a)),
      b: Math.round(fg.b * a + bg.b * (1 - a)),
    }
  }

  // CSS-based bg estimate. picks up ::before/::after overlays with inset:0
  // (the typical "darken bg-image" pattern). still wrong when there's a real
  // bg-image — for those we sample pixels via screenshot instead.
  function getBgColor(el) {
    let r = 255, g = 255, b = 255
    const stack = []
    let node = el

    while (node && node !== document.documentElement) {
      const own = window.getComputedStyle(node)
      const bg  = parseColor(own.backgroundColor)

      const overlays = []
      for (const pseudo of ['::before', '::after']) {
        const s = window.getComputedStyle(node, pseudo)
        const c = parseColor(s.backgroundColor)
        const positioned = s.position === 'absolute' || s.position === 'fixed'
        const hasContent = s.content && s.content !== 'none' && s.content !== 'normal'
        const insetZero  = s.top === '0px' && s.right === '0px' && s.bottom === '0px' && s.left === '0px'
        if (c && c.a > 0 && positioned && hasContent && insetZero) overlays.push(c)
      }

      if (overlays.length) stack.unshift(...overlays)
      if (bg && bg.a > 0)  stack.unshift(bg)
      node = node.parentElement
    }

    for (const c of stack) {
      const a = c.a
      r = Math.round(c.r * a + r * (1 - a))
      g = Math.round(c.g * a + g * (1 - a))
      b = Math.round(c.b * a + b * (1 - a))
    }
    return { r, g, b }
  }

  // returns true if some ancestor has a bg-image that's not covered by a
  // near-opaque solid bg-color between the element and the image. 0.92 is
  // the cutoff — anything more transparent shows enough of the image
  // through that the css-only estimate becomes unreliable.
  function hasBgImageInTree(el) {
    let node = el
    while (node && node !== document.documentElement) {
      const own = window.getComputedStyle(node)
      if (own.backgroundImage && own.backgroundImage !== 'none') return true
      for (const pseudo of ['::before', '::after']) {
        const s = window.getComputedStyle(node, pseudo)
        if (s.backgroundImage && s.backgroundImage !== 'none') return true
      }
      const bg = parseColor(own.backgroundColor)
      if (bg && bg.a >= 0.92) return false
      node = node.parentElement
    }
    return false
  }

  function isInViewport(rect) {
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.top  < window.innerHeight &&
      rect.right  > 0 && rect.left < window.innerWidth
  }

  function isTextVisible(style, fgColor) {
    if (style.display    === 'none')   return false
    if (style.visibility === 'hidden') return false
    if (parseFloat(style.opacity)  === 0) return false
    if (parseFloat(style.fontSize) <  1)  return false
    if (parseFloat(style.textIndent) < -100) return false
    if (!fgColor || fgColor.a === 0) return false
    return true
  }

  // common screen-reader-only patterns that the visibility check above misses:
  // 1×1 clipped boxes, absolutely positioned off-screen, clip-path:inset(50%).
  function isScreenReaderOnly(el, style) {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 1 && rect.height <= 1) return true
    if (style.clipPath && /inset\(\s*50%/.test(style.clipPath)) return true
    if (style.clip && /rect\(\s*0(px)?\s*,?\s*0(px)?\s*,?\s*0(px)?\s*,?\s*0(px)?/.test(style.clip)) return true
    // pushed far off-screen via absolute positioning (left: -9999px etc.)
    if (style.position === 'absolute' || style.position === 'fixed') {
      if (rect.right < 0 || rect.left > window.innerWidth + 50) return true
    }
    return false
  }

  function getPseudoFg(el) {
    for (const pseudo of ['::before', '::after']) {
      const s = window.getComputedStyle(el, pseudo)
      const hasContent = s.content && s.content !== 'none' && s.content !== 'normal' && s.content !== '""' && s.content !== "''"
      if (!hasContent) continue
      const color = parseColor(s.color)
      if (color && color.a > 0) return color
    }
    return null
  }

  const TAGS = 'h1,h2,h3,h4,h5,h6,p,a,span,li,td,th,label,button,figcaption,blockquote,small,b,strong'
  const IGNORE_SELECTORS = window.__ignoreSelectors ?? []
  const isIgnored = (el) => IGNORE_SELECTORS.some(sel => { try { return !!el.closest(sel) } catch { return false } })

  const textEls = Array.from(document.querySelectorAll(TAGS)).filter(el => {
    if (isIgnored(el)) return false
    const text = (el.innerText || el.textContent || '').trim()
    if (!text) return false
    return Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())
  })

  const candidates = []
  for (const el of textEls) {
    const style   = window.getComputedStyle(el)
    let   fgColor = parseColor(style.color)
    let   fontSize    = parseFloat(style.fontSize)
    let   fontWeight  = parseInt(style.fontWeight)
    let   pseudoFg    = false

    if (isScreenReaderOnly(el, style)) continue

    if (!isTextVisible(style, fgColor)) {
      const pseudo = getPseudoFg(el)
      if (!pseudo) continue
      fgColor    = pseudo
      pseudoFg   = true
      const ps   = window.getComputedStyle(el, '::before')
      const pf   = parseFloat(ps.fontSize)
      const pw   = parseInt(ps.fontWeight)
      if (pf > 0) fontSize   = pf
      if (pw)     fontWeight = pw
    }

    if (!fgColor) continue
    const text = (el.innerText || el.textContent || '').trim().slice(0, 60)
    candidates.push({
      el, fgColor, text, fontSize, fontWeight,
      isPlaceholder: false,
      pseudoFg,
    })
  }

  const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]')
  inputs.forEach(input => {
    if (isIgnored(input)) return
    const placeholder = input.getAttribute('placeholder')
    if (!placeholder) return
    const phStyle = window.getComputedStyle(input, '::placeholder')
    const fgColor = parseColor(phStyle.color)
    if (!fgColor) return
    candidates.push({
      el: input, fgColor, text: placeholder,
      fontSize:   parseFloat(phStyle.fontSize) || parseFloat(window.getComputedStyle(input).fontSize),
      fontWeight: parseInt(phStyle.fontWeight)  || parseInt(window.getComputedStyle(input).fontWeight),
      isPlaceholder: true,
    })
  })

  if (candidates.length === 0) {
    errors.push({ message: t('No text elements found') })
    if (activatedByUs) document.documentElement.classList.remove(contrastClass)
    return finish()
  }

  const toSample = []
  for (const c of candidates) {
    c.cssBg     = getBgColor(c.el)
    c.onBgImage = hasBgImageInTree(c.el)
    if (c.onBgImage) {
      const rect = c.el.getBoundingClientRect()
      if (isInViewport(rect)) {
        // for small elements (likely icons) sample a ring around the rect so
        // we hit the actual bg, not the glyph pixels. larger rects keep the
        // existing inside-sampling.
        const small = rect.width < 40 && rect.height < 40
        c.sampleRect = small
          ? { x: rect.x - 20, y: rect.y - 20, width: rect.width + 40, height: rect.height + 40,
              excludeRect: { x: rect.x - 2, y: rect.y - 2, width: rect.width + 4, height: rect.height + 4 } }
          : { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        toSample.push(c)
      } else {
        c.offScreen = true
      }
    }
  }

  if (toSample.length > 0) {
    const reply = await runInBackground('CONTRAST_SAMPLE_BG', {
      viewportWidth: window.innerWidth,
      targets: toSample.map(c => ({
        rect:        c.sampleRect,
        excludeRect: c.sampleRect.excludeRect ?? null,
        fg:          premultiply(c.fgColor, c.cssBg),
      })),
    })
    const sampled = reply?.colors ?? []
    toSample.forEach((c, i) => {
      if (sampled[i]) c.sampledBg = sampled[i]
    })
  }

  for (const c of candidates) {
    const bg          = c.sampledBg || c.cssBg
    const fg          = premultiply(c.fgColor, bg)
    const ratio       = contrastRatio(fg, bg)
    const isLarge     = c.fontSize >= 18 || (c.fontWeight >= 700 && c.fontSize >= 14)
    const aaMin       = isLarge ? 3.0 : 4.5
    const passAA      = ratio >= aaMin
    const unreliable  = !passAA && c.onBgImage && !c.sampledBg
    const level       = passAA ? 'AA' : unreliable ? 'Unsafe' : 'Fail'
    const fgHex       = toHex(fg)
    const bgHex       = toHex(bg)
    const tagIdx      = Array.from(document.querySelectorAll(c.el.tagName)).indexOf(c.el)
    const titleSuffix = c.isPlaceholder ? ` (${t('Placeholder')})` : c.pseudoFg ? ` (${t('Icon')})` : ''

    addItem(c.el, [
      {
        when:  !passAA && !unreliable,
        type:  'error',
        title: `${t('Contrast too low ({ratio}:1)', { ratio })}${titleSuffix}`,
        description: t('At least {min}:1 required (WCAG AA)', { min: aaMin }),
      },
      {
        when:  unreliable,
        type:  'warning',
        title: `${t('Contrast not measurable — outside viewport')}${titleSuffix}`,
        description: t('Scroll the element into view and recheck'),
      },
      {
        when:  passAA,
        type:  'success',
        title: `${ratio}:1 – ${t('AA')}${titleSuffix}`,
        description: c.text,
      },
    ], {
      text: c.text, ratio, level, fgHex, bgHex, isLarge,
      isPlaceholder: c.isPlaceholder,
      _meta: { tag: c.el.tagName, idx: tagIdx, text: c.text.slice(0, 40) },
    })
  }

  if (activatedByUs) document.documentElement.classList.remove(contrastClass)
  return finish()
}
