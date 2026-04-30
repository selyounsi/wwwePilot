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

  const target = document.documentElement
  for (const m of messages) {
    addItem(target, [{
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
      _meta:    { selector: 'html' },
    })
  }

  return finish()
}
