export function useCheckRunner() {

  async function injectHelper(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__wpHelpersInjected) return
        window.__wpHelpersInjected = true

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

        // UUIDs avoid the cross-module ID collision that a shared counter
        // would have when modules run in parallel.
        window.setHighlightElement = () => crypto.randomUUID()

        // detects visible content beyond plain text — child <img>/<svg>,
        // ::before/::after content (icon fonts), or background-image (CSS icons).
        // shared helper for any module that needs to distinguish empty
        // elements from icon-only / pseudo-styled ones.
        window.hasVisualContent = (el) => {
          if (!el) return false
          if ((el.innerText || el.textContent || '').trim()) return true
          if (el.querySelector('img[src], svg, picture, video, canvas')) return true

          const own = window.getComputedStyle(el)
          if (own.backgroundImage && own.backgroundImage !== 'none') return true

          for (const pseudo of ['::before', '::after']) {
            const s = window.getComputedStyle(el, pseudo)
            const c = s.content
            if (c && c !== 'none' && c !== 'normal' && c !== '""' && c !== "''") return true
            if (s.backgroundImage && s.backgroundImage !== 'none') return true
          }
          return false
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

  return { injectHelper }
}