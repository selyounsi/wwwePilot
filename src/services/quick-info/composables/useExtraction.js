import { reactive } from 'vue'

const state = reactive({
  values:  {},      // ruleId -> string | { text, href } | array
  running: false,
  error:   null,
})

/**
 * Runs every rule in a profile against the live DOM of `tabId`. One single
 * `chrome.scripting.executeScript` call evaluates all selectors, so we get
 * one roundtrip independent of rule count.
 *
 * Returned shape is keyed by rule id. Failures yield `null` (kind=text) or
 * `{ text: null, href: null }` (kind=link) so the UI can render dashes.
 */
async function runExtraction(profile, tabId) {
  if (!profile || !tabId) {
    state.values = {}
    return state.values
  }
  state.running = true
  state.error = null

  const rules = profile.sections.flatMap(s => s.rules.map(r => ({
    id:       r.id,
    kind:     r.kind,
    selector: r.selector,
    pattern:  r.pattern,
    multiple: r.multiple,
  })))

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func:   extractInPage,
      args:   [rules],
    })
    state.values = injection?.result ?? {}
    return state.values
  } catch (e) {
    state.error = e?.message ?? String(e)
    state.values = {}
    throw e
  } finally {
    state.running = false
  }
}

function extractInPage(rules) {
  const out = {}

  function applyPattern(text, pattern) {
    if (!pattern) return text
    try {
      const m = new RegExp(pattern).exec(text)
      if (!m) return null
      return m[1] ?? m[0]
    } catch {
      return null
    }
  }

  function readText(node) {
    // innerText respects <br> + collapses runs the same way the browser
    // renders it, falling back to textContent for detached / hidden nodes.
    const raw = (node.innerText ?? node.textContent ?? '')
    return raw.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
  }

  function extractValue(node, rule) {
    if (!node) return rule.kind === 'link' ? { text: null, href: null } : null
    if (rule.kind === 'link') {
      // node.href resolves relative paths against the page's base URI,
      // mailto:/tel: pass through. node.getAttribute('href') would keep
      // "/project/123" relative, which the sidebar would then resolve
      // against the extension's own origin (wrong) when clicking.
      const href = (node.href || node.getAttribute('href')) ?? null
      const raw  = readText(node)
      const candidate = raw || href || ''
      const result = applyPattern(candidate, rule.pattern)
      const text = result && result.trim() ? result.trim() : null
      return { text, href }
    }
    const raw = readText(node)
    if (!raw) return null
    const result = applyPattern(raw, rule.pattern)
    if (!result || !result.trim()) return null
    return result.trim()
  }

  function isEmpty(v) {
    if (v == null) return true
    if (typeof v === 'string') return v.trim() === ''
    if (typeof v === 'object') return !v.text && !v.href
    return false
  }

  for (const rule of rules) {
    try {
      if (rule.multiple) {
        const nodes = Array.from(document.querySelectorAll(rule.selector))
        out[rule.id] = nodes.map(n => extractValue(n, rule)).filter(v => !isEmpty(v))
      } else {
        out[rule.id] = extractValue(document.querySelector(rule.selector), rule)
      }
    } catch {
      out[rule.id] = rule.multiple ? [] : (rule.kind === 'link' ? { text: null, href: null } : null)
    }
  }
  return out
}

export function useExtraction() {
  return { state, runExtraction }
}
