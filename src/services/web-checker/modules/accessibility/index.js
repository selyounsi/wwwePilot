export const checkOnReload = false
export const allowChatBot = true
export const overlay = null

export default async function check() {
  const reply = await new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'AXE_RUN' }, resolve)
  })

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

      // axe impact: 'critical' | 'serious' | 'moderate' | 'minor' | null
      // 'critical' / 'serious' → error, others → warning. incomplete (manual review) → warning.
      const isError = kind === 'violation' && (v.impact === 'critical' || v.impact === 'serious')
      const issueType = isError ? 'error' : 'warning'
      const titlePrefix = kind === 'incomplete' ? '[Manuelle Prüfung] ' : ''

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
