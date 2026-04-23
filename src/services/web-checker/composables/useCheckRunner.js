export function useCheckRunner() {

  async function injectHelper(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__wpHelpersInjected) return
        window.__wpHelpersInjected = true

        window.__wpModuleCounters = {}
        window.__wpCurrentModule  = null

        window.isElementVisible = (el) => {
          if (!el) return false
          const style = window.getComputedStyle(el)
          if (style.display === 'none')        return false
          if (style.visibility === 'hidden')   return false
          if (parseFloat(style.opacity) === 0) return false

          const t = style.transform
          if (t && t !== 'none') {
            const m = t.match(/matrix\(([^)]+)\)/)
            if (m) {
              const v = m[1].split(',').map(Number)
              if (Math.abs(v[0]) < 0.01 || Math.abs(v[3]) < 0.01) return false
            }
          }

          let parent = el.parentElement
          while (parent && parent !== document.body) {
            const ps = window.getComputedStyle(parent)
            if (ps.display === 'none' || ps.visibility === 'hidden') return false
            if (ps.position === 'fixed' || ps.position === 'sticky') break
            parent = parent.parentElement
          }
          return true
        }

        window.setHighlightElement = (el, type, title, description, meta) => {
          const mod = window.__wpCurrentModule ?? 'unknown'
          window.__wpModuleCounters[mod] = window.__wpModuleCounters[mod] ?? 0
          return `${mod}-${window.__wpModuleCounters[mod]++}`
        }

        window.createCheckResult = () => {
          const errors = [], warnings = [], items = []

          function addItem(el, checks, extra = {}) {
            const issues = checks
              .filter(c => c.when && c.type !== 'success')
              .map(({ type, title }) => ({ type, message: title }))

            const status = issues.some(i => i.type === 'error')   ? 'error'
                         : issues.some(i => i.type === 'warning') ? 'warning'
                         : 'success'

            issues.filter(i => i.type === 'error').forEach(i => errors.push({ message: i.message }))
            issues.filter(i => i.type === 'warning').forEach(i => warnings.push({ message: i.message }))

            items.push({
              type: status, issues,
              visible: isElementVisible(el),
              element: setHighlightElement(el, status,
                issues[0]?.message ?? '',
                issues.map(i => i.message).join(' · '),
                extra._meta ?? {}
              ),
              ...extra,
            })
          }

          function finish() {
            const merge = (list) => {
              const map = {}
              list.forEach(({ message }) => { map[message] = (map[message] ?? 0) + 1 })
              return Object.entries(map).map(([message, count]) =>
                count > 1 ? { message: `${message} (${count}x)` } : { message }
              )
            }
            return {
              errors:       merge(errors),
              warnings:     merge(warnings),
              errorCount:   errors.length,
              warningCount: warnings.length,
              items,
            }
          }

          return { errors, warnings, items, addItem, finish }
        }
      }
    })
  }

  async function prepareModule(tabId, moduleId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (moduleId) => {
        window.__wpModuleCounters = window.__wpModuleCounters ?? {}
        window.__wpModuleCounters[moduleId] = 0
        window.__wpCurrentModule = moduleId
      },
      args: [moduleId],
    })
  }

  return { injectHelper, prepareModule }
}