export const type = 'AXE_RUN'

// Fallback if the backend config didn't load. Kept tight on purpose —
// the live list lives in _apps/backend/src/config/web-checker/modules/accessibility.js.
const FALLBACK_DISABLED_RULES = [
  'color-contrast',
  'image-alt',
  'link-name',
  'heading-order',
  'empty-heading',
  'html-has-lang',
  'meta-viewport',
  'document-title',
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
      func: async (fallbackDisabled, locale) => {
        if (!window.axe) return { error: 'axe-core konnte nicht geladen werden' }
        if (locale) {
          try { window.axe.configure({ locale }) } catch (e) { console.warn('[axe] locale failed', e) }
        }
        const backendDisabled = window.__webCheckerConfig?.modules?.accessibility?.disabledRules
        const disabledRules   = Array.isArray(backendDisabled) ? backendDisabled : fallbackDisabled
        const rules = Object.fromEntries(disabledRules.map(id => [id, { enabled: false }]))
        const exclude = (window.__ignoreSelectors ?? [])
          .filter(sel => { try { document.querySelector(sel); return true } catch { return false } })
          .map(sel => [sel])
        const context = exclude.length ? { exclude } : document
        const results = await window.axe.run(context, {
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
      args: [FALLBACK_DISABLED_RULES, locale],
    })

    sendResponse(res?.result ?? { error: 'Keine Antwort von axe' })
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
