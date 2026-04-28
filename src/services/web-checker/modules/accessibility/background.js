export const type = 'AXE_RUN'

// Rules already covered by other modules — disabled to avoid duplicate findings.
const DISABLED_RULES = [
  'color-contrast',         // contrast module (with pixel sampling)
  'image-alt',              // images module
  'link-name',              // links module
  'heading-order',          // headings module
  'empty-heading',          // headings module
  'html-has-lang',          // overview module
  'meta-viewport',          // overview module
  'document-title',         // overview module (meta-title)
]

async function loadGermanLocale() {
  try {
    const res = await fetch(chrome.runtime.getURL('axe-locale-de.json'))
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function handle(msg, sendResponse, sender) {
  try {
    const tabId = sender?.tab?.id
    if (!tabId) {
      sendResponse({ error: 'Tab-ID nicht verfügbar' })
      return
    }

    const locale = await loadGermanLocale()

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['axe.min.js'],
    })

    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (disabledRules, locale) => {
        if (!window.axe) return { error: 'axe-core konnte nicht geladen werden' }
        if (locale) {
          try { window.axe.configure({ locale }) } catch (e) { console.warn('[axe] locale failed', e) }
        }
        const rules = Object.fromEntries(disabledRules.map(id => [id, { enabled: false }]))
        const results = await window.axe.run(document, {
          resultTypes: ['violations', 'incomplete'],
          rules,
        })
        const map = v => ({
          id:          v.id,
          impact:      v.impact,
          description: v.description,
          help:        v.help,
          helpUrl:     v.helpUrl,
          tags:        v.tags,
          nodes:       v.nodes.map(n => ({
            html:           n.html,
            target:         n.target,
            failureSummary: n.failureSummary,
            impact:         n.impact,
          })),
        })
        return {
          violations: results.violations.map(map),
          incomplete: results.incomplete.map(map),
        }
      },
      args: [DISABLED_RULES, locale],
    })

    sendResponse(res?.result ?? { error: 'Keine Antwort von axe' })
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
