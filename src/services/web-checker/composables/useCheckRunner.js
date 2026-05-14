import { useI18n }                from '@/composables/i18n/useI18n.js'
import { useWebCheckerSettings } from './useWebCheckerSettings.js'
import { useWebCheckerConfig }   from './useWebCheckerConfig.js'
import { useRunHistory }         from './useRunHistory.js'
import { useActivityLog }        from '@/composables/useActivityLog.js'
import { getAllModuleSettings }  from '@/composables/settings/useModuleSettings.js'

export function useCheckRunner() {
  const { getTable }                 = useI18n()
  const { effectiveIgnoreSelectors } = useWebCheckerSettings()
  const { state: configState }       = useWebCheckerConfig()
  const { record: recordHistory }    = useRunHistory()
  const { record: recordActivity }   = useActivityLog()

  async function injectHelper(tabId) {
    const translations    = getTable()
    const ignoreSelectors = [...effectiveIgnoreSelectors.value]
    const moduleSettings  = getAllModuleSettings()
    // Strip Vue's reactive proxy. structuredClone (used by chrome.scripting
    // executeScript args) can flatten nested arrays inside proxies into
    // numeric-keyed objects, breaking modules that call .map/.filter on them.
    const backendConfig   = JSON.parse(JSON.stringify(configState.config))
    const pageSnap        = await snapshotPageWindow(tabId)
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (translations, ignoreSelectors, moduleSettings, backendConfig, pageWindow, pageConsent) => {
        window.__translations      = translations
        window.__ignoreSelectors   = ignoreSelectors
        window.__moduleSettings    = moduleSettings
        window.__webCheckerConfig  = backendConfig

        function detectCms() {
          const html          = document.documentElement
          const dataFwVersion = html.getAttribute('data-fw-version')
          const dataFw        = html.getAttribute('data-fw')

          if (dataFwVersion) return { version: 'cms4', dataFwVersion, dataFw: null, legacy: false }
          if (dataFw)        return { version: 'cms3', dataFwVersion: null, dataFw, legacy: false }

          const hasScript    = (sub) => !!document.querySelector(`script[src*="${sub}"]`)
          const hasEwcms3    = hasScript('/ewcms3/js/ewcms_js.js')
          const hasSiteJs    = hasScript('/js/site.js')
          const hasRequireJs = hasScript('/js/_require.js')
          const files        = { ewcms3: hasEwcms3, siteJs: hasSiteJs, requireJs: hasRequireJs }

          if (hasEwcms3 && !hasRequireJs) return { version: 'cms3', dataFwVersion: null, dataFw: null, legacy: true,  files }
          if (hasEwcms3)                  return { version: 'cms3', dataFwVersion: null, dataFw: null, legacy: false, files }
          return { version: 'unknown', dataFwVersion: null, dataFw: null, legacy: false, files }
        }

        const cms = detectCms()
        cms.hasPrivacyControl = !!(pageWindow?.privacyControl || pageWindow?.PrivacyControl)
        cms.hasRequireIt      = !!(pageWindow?.rIt || pageWindow?.requireJS)

        window.cms     = cms
        window.consent = pageConsent

        const isolatedOwn = new Set(Object.getOwnPropertyNames(window))
        for (const [key, value] of Object.entries(pageWindow ?? {})) {
          if (isolatedOwn.has(key)) continue
          try { window[key] = value } catch {}
        }

        window.__t = (key, params) => {
          let s = translations[key] ?? key
          if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`)
          return s
        }

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

        // promise-based wrapper around chrome.runtime.sendMessage so modules
        // can call service-worker handlers without re-implementing the boilerplate.
        window.runInBackground = (type, payload = {}) => new Promise(resolve => {
          chrome.runtime.sendMessage({ type, ...payload }, resolve)
        })

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
              .map(({ type, title, description }) => ({ type, message: title, description: description || '' }))

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
      },
      args: [translations, ignoreSelectors, moduleSettings, backendConfig, pageSnap.window, pageSnap.consent],
    })
  }

  async function snapshotPageWindow(tabId) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        world:  'MAIN',
        func:   () => {
          const out = {}
          for (const key of Object.keys(window)) {
            try {
              const json = JSON.stringify(window[key], (_, v) => typeof v === 'function' ? undefined : v)
              if (json && json.length <= 200_000) out[key] = JSON.parse(json)
            } catch {}
          }
          let consent = null
          try {
            const pc = window.privacyControl ?? window.PrivacyControl
            if (pc && typeof pc.get === 'function') consent = pc.get('all') ?? null
          } catch {}
          return { window: out, consent }
        },
      })
      return res?.result ?? { window: {}, consent: null }
    } catch {
      return { window: {}, consent: null }
    }
  }

  async function runChecker(tabId, mod) {
    const startedAt = Date.now()
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func:   mod.checker,
      args:   mod.apiConfig ? [mod.apiConfig] : [],
    })
    try {
      const tab    = await chrome.tabs.get(tabId)
      const origin = tab?.url ? new URL(tab.url).origin : null
      const result = res?.[0]?.result
      if (origin && result) {
        recordHistory(origin, mod.id, result)
        recordActivity('web_check.module', origin, {
          moduleId:     mod.id,
          errorCount:   result.errorCount   ?? 0,
          warningCount: result.warningCount ?? 0,
          durationMs:   Date.now() - startedAt,
        })
      }
    } catch {}
    return res
  }

  return { injectHelper, runChecker }
}