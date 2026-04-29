export const overlay = null

export default async function check() {
  // CSS selectors — matched elements (and everything inside them) are
  // stripped before validation
  const IGNORE_SELECTORS = [
    '.WidgetSealContainer',
    '#cookie-banner',
  ]

  // HTMLHint rule IDs — silenced globally
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
      title:       m.message || '(unbekannt)',
      description: m.line ? `Zeile ${m.line}, Spalte ${m.column}` : '',
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
