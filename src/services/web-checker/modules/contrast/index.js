export const checkOnReload = true
export const overlay = {
  enabled: true,
  labelFn: (item) => `${item.ratio}:1 – ${item.level}`,
  onText:  'Kontrast ausblenden',
  offText: 'Kontrast einblenden',
}

export default async function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()

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

  function hasBgImageInTree(el) {
    let node = el
    while (node && node !== document.documentElement) {
      const own = window.getComputedStyle(node)
      if (own.backgroundImage && own.backgroundImage !== 'none') return true
      for (const pseudo of ['::before', '::after']) {
        const s = window.getComputedStyle(node, pseudo)
        if (s.backgroundImage && s.backgroundImage !== 'none') return true
      }
      // fully opaque bg-color blocks any image below — no need to sample
      const bg = parseColor(own.backgroundColor)
      if (bg && bg.a >= 1) return false
      node = node.parentElement
    }
    return false
  }

  function isInViewport(rect) {
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.top  < window.innerHeight &&
      rect.right  > 0 && rect.left < window.innerWidth
  }

  // text node is effectively invisible — common when an icon is rendered via
  // ::before and the actual text is hidden via font-size:0, transparent color,
  // text-indent off-screen, etc.
  function isTextVisible(style, fgColor) {
    if (style.display    === 'none')   return false
    if (style.visibility === 'hidden') return false
    if (parseFloat(style.opacity)  === 0) return false
    if (parseFloat(style.fontSize) <  1)  return false
    if (parseFloat(style.textIndent) < -100) return false
    if (!fgColor || fgColor.a === 0) return false
    return true
  }

  // when text is hidden, fall back to the colour of a visible pseudo-element.
  // pseudo with content (icon font etc.) — its `color` is the icon colour.
  // pseudo with only background-image — we can't determine pixel colour, skip.
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

  // Collect text candidates
  const TAGS = 'h1,h2,h3,h4,h5,h6,p,a,span,li,td,th,label,button,figcaption,blockquote,small,b,strong'
  const textEls = Array.from(document.querySelectorAll(TAGS)).filter(el => {
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

    // text invisible — try to fall back to a visible ::before/::after colour
    if (!isTextVisible(style, fgColor)) {
      const pseudo = getPseudoFg(el)
      if (!pseudo) continue // truly invisible (sr-only / display:none / etc.)
      fgColor    = pseudo
      pseudoFg   = true
      // pseudo's font metrics drive the size threshold
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

  // Collect placeholder candidates (input/textarea with placeholder attr)
  const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]')
  inputs.forEach(input => {
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
    errors.push({ message: 'Keine Textelemente gefunden' })
    return finish()
  }

  // Tag candidates with CSS-based bg + screenshot-sample candidates
  const toSample = []
  for (const c of candidates) {
    c.cssBg     = getBgColor(c.el)
    c.onBgImage = hasBgImageInTree(c.el)
    if (c.onBgImage) {
      const rect = c.el.getBoundingClientRect()
      if (isInViewport(rect)) {
        c.sampleRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        toSample.push(c)
      } else {
        c.offScreen = true
      }
    }
  }

  // Capture & sample via service worker
  if (toSample.length > 0) {
    const reply = await new Promise(resolve => {
      chrome.runtime.sendMessage({
        type: 'CONTRAST_SAMPLE_BG',
        viewportWidth: window.innerWidth,
        targets: toSample.map(c => ({
          rect: c.sampleRect,
          fg:   premultiply(c.fgColor, c.cssBg),
        })),
      }, resolve)
    })
    const sampled = reply?.colors ?? []
    toSample.forEach((c, i) => {
      if (sampled[i]) c.sampledBg = sampled[i]
    })
  }

  // Emit items
  for (const c of candidates) {
    const bg          = c.sampledBg || c.cssBg
    const fg          = premultiply(c.fgColor, bg)
    const ratio       = contrastRatio(fg, bg)
    const isLarge     = c.fontSize >= 18 || (c.fontWeight >= 700 && c.fontSize >= 14)
    const aaMin       = isLarge ? 3.0 : 4.5
    const passAA      = ratio >= aaMin
    const unreliable  = !passAA && c.onBgImage && !c.sampledBg
    const level       = passAA ? 'AA' : unreliable ? 'Unsicher' : 'Fail'
    const fgHex       = toHex(fg)
    const bgHex       = toHex(bg)
    const tagIdx      = Array.from(document.querySelectorAll(c.el.tagName)).indexOf(c.el)
    const titleSuffix = c.isPlaceholder ? ' (Placeholder)' : c.pseudoFg ? ' (Icon)' : ''

    addItem(c.el, [
      {
        when:  !passAA && !unreliable,
        type:  'error',
        title: `Kontrast zu gering (${ratio}:1)${titleSuffix}`,
        description: `Mindestens ${aaMin}:1 erforderlich (WCAG AA)`,
      },
      {
        when:  unreliable,
        type:  'warning',
        title: `Kontrast nicht prüfbar — außerhalb Viewport${titleSuffix}`,
        description: 'Element sichtbar scrollen und Modul erneut prüfen',
      },
      {
        when:  passAA,
        type:  'success',
        title: `${ratio}:1 – AA${titleSuffix}`,
        description: c.text,
      },
    ], {
      text: c.text, ratio, level, fgHex, bgHex, isLarge,
      isPlaceholder: c.isPlaceholder,
      _meta: { tag: c.el.tagName, idx: tagIdx, text: c.text.slice(0, 40) },
    })
  }

  return finish()
}
