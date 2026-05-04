export const overlay = null

export default async function check() {
  const t = window.__t

  // module-specific exclusions stay here; .WidgetSealContainer + general
  // third-party widgets live in Settings → window.__ignoreSelectors
  const IGNORE_SELECTORS = [
    '#cookie-banner',
    ...(window.__ignoreSelectors ?? []),
  ]

  const IGNORE_RULES = [
    // 'inline-style-disabled',
  ]

  const root = document.documentElement.cloneNode(true)
  for (const sel of IGNORE_SELECTORS) {
    try { root.querySelectorAll(sel).forEach(el => el.remove()) } catch {}
  }
  const html  = '<!DOCTYPE html>\n' + root.outerHTML
  const reply = await runInBackground('VALIDATE_HTML', { html })

  const { errors, addItem, finish } = createCheckResult()

  if (reply?.error) {
    errors.push({ message: `Validator: ${reply.error}` })
    return finish()
  }

  const messages = (reply?.messages ?? []).filter(m => !IGNORE_RULES.includes(m.ruleId))
  if (messages.length === 0) return finish()

  const html2 = document.documentElement
  // For some rules the offending fragment can be mapped to a real DOM
  // element so the user can click the audit item and jump to it. We track
  // ruleId-keyed counters because the same value may appear several times in
  // the page; we walk through matching candidates in document order.
  const occurrenceIdx = new Map()

  function findElementForRule(m) {
    if (m.ruleId === 'inline-style-disabled') {
      const match = (m.message ?? '').match(/style="([^"]*)"/)
      if (!match) return null
      const styleValue = match[1]
      const candidates = Array.from(document.querySelectorAll('[style]'))
        .filter(el => el.getAttribute('style') === styleValue)
      if (!candidates.length) return null
      const key = `${m.ruleId}::${styleValue}`
      const i = occurrenceIdx.get(key) ?? 0
      occurrenceIdx.set(key, i + 1)
      return candidates[Math.min(i, candidates.length - 1)] ?? null
    }
    return null
  }

  for (const m of messages) {
    const el     = findElementForRule(m) ?? html2
    const tag    = el.tagName
    const tagIdx = Array.from(document.querySelectorAll(tag)).indexOf(el)
    addItem(el, [{
      when:        true,
      type:        m.type,
      title:       m.message || t('(unknown)'),
      description: m.line ? t('Line {line}, column {column}', { line: m.line, column: m.column }) : '',
    }], {
      ruleId:   m.ruleId,
      ruleLink: m.ruleLink,
      line:     m.line,
      column:   m.column,
      snippet:  m.snippet,
      _meta:    el === html2 ? { selector: 'html' } : { tag, idx: tagIdx },
    })
  }

  return finish()
}
