export const checkOnReload = true
export const overlay = {
  enabled: true,
  labelFn: (item) => `${item.ratio}:1 – ${item.level}`,
  onText:  'Kontrast ausblenden',
  offText: 'Kontrast einblenden',
}

export default function check() {
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

  // Blended background – traversiert DOM und mischt Alpha-Farben korrekt
  function getBgColor(el) {
    let r = 255, g = 255, b = 255

    const stack = []
    let node = el
    while (node && node !== document.documentElement) {
      const bg = window.getComputedStyle(node).backgroundColor
      const c  = parseColor(bg)
      if (c && c.a > 0) stack.unshift(c)
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

  const TAGS = 'h1,h2,h3,h4,h5,h6,p,a,span,li,td,th,label,button,figcaption,blockquote,small,b,strong'
  const els  = Array.from(document.querySelectorAll(TAGS)).filter(el => {
    const text = (el.innerText || el.textContent || '').trim()
    if (!text) return false
    return Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())
  })

  if (els.length === 0) {
    errors.push({ message: 'Keine Textelemente gefunden' })
    return finish()
  }

  els.forEach((el) => {
    const style    = window.getComputedStyle(el)
    const fgColor  = parseColor(style.color)
    const bgColor  = getBgColor(el)
    if (!fgColor) return

    // Vordergrundfarbe mit eigenem Alpha blenden
    const fg = {
      r: Math.round(fgColor.r * fgColor.a + bgColor.r * (1 - fgColor.a)),
      g: Math.round(fgColor.g * fgColor.a + bgColor.g * (1 - fgColor.a)),
      b: Math.round(fgColor.b * fgColor.a + bgColor.b * (1 - fgColor.a)),
    }

    const ratio    = contrastRatio(fg, bgColor)
    const fontSize = parseFloat(style.fontSize)
    const bold     = parseInt(style.fontWeight) >= 700
    const isLarge  = fontSize >= 18 || (bold && fontSize >= 14)
    const aaMin    = isLarge ? 3.0 : 4.5
    const passAA   = ratio >= aaMin
    const level    = passAA ? 'AA' : 'Fail'
    const text     = (el.innerText || el.textContent || '').trim().slice(0, 60)
    const fgHex    = toHex(fg)
    const bgHex    = toHex(bgColor)
    const tagIdx   = Array.from(document.querySelectorAll(el.tagName)).indexOf(el)

    addItem(el, [
      {
        when:        !passAA,
        type:        'error',
        title:       `Kontrast zu gering (${ratio}:1)`,
        description: `Mindestens ${aaMin}:1 erforderlich (WCAG AA)`,
      },
      {
        when:        true,
        type:        'success',
        title:       `${ratio}:1 – AA`,
        description: text,
      },
    ], {
      text, ratio, level, fgHex, bgHex, isLarge,
      _meta: { tag: el.tagName, idx: tagIdx, text: text.slice(0, 40) },
    })
  })

  return finish()
}