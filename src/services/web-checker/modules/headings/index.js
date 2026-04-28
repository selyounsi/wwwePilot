export const checkOnReload = true
export const allowChatBot = true
export const overlay = {
  enabled: true,
  labelFn: (item) => item.tag,
  onText:  'Tags ausblenden',
  offText: 'Tags einblenden',
}

export default function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
  const h1s      = document.querySelectorAll('h1')

  if (h1s.length === 0) errors.push({ message: 'Kein H1 Tag gefunden' })

  let lastLevel = 0
  headings.forEach((h) => {
    const level   = parseInt(h.tagName[1])
    const text    = (h.innerText || h.textContent || '').trim()
    const h1Index = level === 1 ? Array.from(h1s).indexOf(h) : -1

    // index relative to the same tag — required by findByMeta in the live editor
    const tagIdx = Array.from(document.querySelectorAll(h.tagName)).indexOf(h)

    const isEmpty    = !text
    const isDuplH1   = h1Index > 0
    const beforeH1   = lastLevel === 0 && level > 1
    const skipsLevel = lastLevel !== 0 && level > lastLevel + 1

    addItem(h, [
      {
        when:        isEmpty,
        type:        'error',
        title:       `${h.tagName} ist leer`,
        description: 'Dieser Heading hat keinen Inhalt',
      },
      {
        when:        isDuplH1,
        type:        'error',
        title:       'H1 mehrfach vorhanden',
        description: `Es gibt ${h1s.length}x H1 – sollte nur einmal vorkommen`,
      },
      {
        when:        beforeH1,
        type:        'warning',
        title:       `${h.tagName} vor H1`,
        description: 'Kein H1 vor diesem Heading – Hierarchie beginnt falsch',
      },
      {
        when:        skipsLevel,
        type:        'warning',
        title:       `Sprung von H${lastLevel} auf H${level}`,
        description: `H${lastLevel + 1} wurde übersprungen`,
      },
      {
        when:        true,
        type:        'success',
        title:       h.tagName,
        description: text,
      },
    ], {
      level,
      text:  text || '(leer)',
      tag:   h.tagName,
      name:  text || h.tagName,
      _meta: { tag: h.tagName, idx: tagIdx }, // idx is per tag-type, not global
    })

    lastLevel = level
  })

  return finish()
}