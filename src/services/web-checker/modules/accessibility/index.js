export const overlay = null

export const claude = {
  title: 'Accessibility-Fix',
  systemPrompt:
    'You are an accessibility expert helping a developer fix an axe-core violation. ' +
    'Reply in German, in 2-4 short paragraphs:\n' +
    '1. Explain in human terms WHY this matters (impact on users with disabilities).\n' +
    '2. Give a CONCRETE CODE FIX with a corrected HTML / ARIA snippet in a fenced ```html block.\n' +
    'Skip axe jargon where possible — this may be read by a designer, not a developer.',
}

export default async function check() {
  const reply = await runInBackground('AXE_RUN')
  const t = window.__t

  const { errors, addItem, finish } = createCheckResult()

  if (reply?.error) {
    errors.push({ message: `axe-core: ${reply.error}` })
    return finish()
  }

  const violations = reply?.violations ?? []
  const incomplete = reply?.incomplete ?? []

  function processFinding(v, kind) {
    v.nodes.forEach(node => {
      const selector = Array.isArray(node.target) ? node.target.join(' ') : String(node.target ?? '')
      let el = null
      try { el = selector ? document.querySelector(selector) : null } catch {}
      const target = el || document.body

      const isError = kind === 'violation' && (v.impact === 'critical' || v.impact === 'serious')
      const issueType = isError ? 'error' : 'warning'
      const titlePrefix = kind === 'incomplete' ? `${t('[Manual review]')} ` : ''

      addItem(target, [{
        when:        true,
        type:        issueType,
        title:       `${titlePrefix}${v.help}`,
        description: node.failureSummary || v.description,
      }], {
        ruleId:    v.id,
        impact:    v.impact || (kind === 'incomplete' ? 'review' : 'unknown'),
        helpText:  v.help,
        helpUrl:   v.helpUrl,
        nodeHtml:  node.html,
        target:    selector,
        kind,
        _meta:     { selector },
      })
    })
  }

  violations.forEach(v => processFinding(v, 'violation'))
  incomplete.forEach(v => processFinding(v, 'incomplete'))

  return finish()
}
