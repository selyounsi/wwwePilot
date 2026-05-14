export const overlay = {
  enabled: true,
  labelFn: (item) => item.tag,
  onText:  'Hide tags',
  offText: 'Show tags',
}

export const claude = {
  title: 'Heading-Vorschlag',
  systemPrompt:
    'You are an SEO and content strategist. The user found an issue with a page\'s heading hierarchy. ' +
    'Reply in German, briefly:\n' +
    '1. Why proper heading order matters (SEO + screen readers).\n' +
    '2. If the order is broken, suggest a CORRECTED heading hierarchy in a fenced ```html block.\n' +
    '3. If the h1 itself is weak (vague, missing keywords), suggest a stronger one.',
}

export default function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()
  const t = window.__t

  const IGNORE_SELECTORS = window.__ignoreSelectors ?? []
  const isIgnored = (el) => IGNORE_SELECTORS.some(sel => { try { return !!el.closest(sel) } catch { return false } })

  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(el => !isIgnored(el))
  const h1s      = Array.from(document.querySelectorAll('h1')).filter(el => !isIgnored(el))

  if (h1s.length === 0) errors.push({ message: t('No H1 tag found') })

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
        title:       t('{tag} is empty', { tag: h.tagName }),
        description: t('This heading has no content'),
      },
      {
        when:        isDuplH1,
        type:        'error',
        title:       t('Multiple H1 tags'),
        description: t('Found {count}× H1 — should appear only once', { count: h1s.length }),
      },
      {
        when:        beforeH1,
        type:        'warning',
        title:       t('{tag} appears before H1', { tag: h.tagName }),
        description: t('No H1 before this heading — hierarchy starts incorrectly'),
      },
      {
        when:        skipsLevel,
        type:        'warning',
        title:       t('Jump from H{from} to H{to}', { from: lastLevel, to: level }),
        description: t('H{level} was skipped', { level: lastLevel + 1 }),
      },
      {
        when:        true,
        type:        'success',
        title:       h.tagName,
        description: text,
      },
    ], {
      level,
      text:  text || t('(empty)'),
      tag:   h.tagName,
      name:  text || h.tagName,
      _meta: { tag: h.tagName, idx: tagIdx },
    })

    lastLevel = level
  })

  return finish()
}
