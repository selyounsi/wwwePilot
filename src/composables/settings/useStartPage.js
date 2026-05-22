import { reactive, computed } from 'vue'
import { createSettingsStore } from './createSettingsStore.js'
import { useServiceLoader }    from '@/composables/loaders/useServiceLoader.js'
import { useModuleLoader }     from '@/composables/loaders/useModuleLoader.js'
import { useFeatureFlags }     from '@/composables/useFeatureFlags.js'
import { useI18n }             from '@/composables/i18n/useI18n.js'

/**
 * Persists which page the sidebar should land on at start. Default is the
 * dashboard. Users can pick any active service or module via Settings.
 *
 * Storage value is a stable string token, decoupled from the actual URL so a
 * later router rename doesn't break saved preferences:
 *   'dashboard'                 → '/'
 *   'service:<id>'              → '/service/<id>'
 *   'module:<svc>:<mod>'        → '/service/<svc>/module/<mod>'
 *
 * The composable also exposes `resolveAvailablePath()` which converts the
 * stored token to a router path and falls back to '/' when the underlying
 * service / module is feature-flagged off (or the folder was removed).
 */

const STORAGE_KEY  = 'wp-start-page'
const DEFAULT_TOKEN = 'dashboard'

const state = reactive({
  token: DEFAULT_TOKEN,
})

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  onHydrate(stored, s) {
    if (stored && typeof stored.token === 'string') s.token = stored.token
  },
  onSerialize(s) {
    return { token: s.token }
  },
})

export function whenStartPageHydrated() {
  return hydrationPromise
}

function tokenToPath(token) {
  if (!token || token === 'dashboard') return '/'
  if (token.startsWith('service:')) {
    const id = token.slice('service:'.length)
    return id ? `/service/${id}` : '/'
  }
  if (token.startsWith('module:')) {
    const rest = token.slice('module:'.length)
    const [svc, mod] = rest.split(':')
    if (svc && mod) return `/service/${svc}/module/${mod}`
  }
  return '/'
}

/**
 * Services whose module routes render as full standalone pages (own AppHeader,
 * own scroll container). Modules under other services are typically embedded
 * inside the service's HomeView — landing on `/service/<svc>/module/<mod>`
 * directly would skip the wrapping header and break navigation.
 * Web-checker modules use ModulePage which has its own AppHeader; chatbot
 * modules are content-only and need the service shell around them.
 */
const STANDALONE_MODULE_SERVICES = new Set(['web-checker'])

function isTokenAvailable(token, { services, isEnabled }) {
  if (token === 'dashboard') return true
  if (token.startsWith('service:')) {
    const id = token.slice('service:'.length)
    if (!services.some(s => s.id === id)) return false
    return isEnabled(`service.${id}`)
  }
  if (token.startsWith('module:')) {
    const [svc, mod] = token.slice('module:'.length).split(':')
    if (!svc || !mod) return false
    if (!STANDALONE_MODULE_SERVICES.has(svc)) return false
    if (!isEnabled(`service.${svc}`)) return false
    if (!isEnabled(`module.${svc}.${mod}`)) return false
    // Also require that the module is actually discovered (folder present).
    const { modules } = useModuleLoader(svc)
    return modules.some(m => m.id === mod)
  }
  return false
}

export function useStartPage() {
  const { services }  = useServiceLoader()
  const { isEnabled } = useFeatureFlags()
  const { t }         = useI18n()

  function setToken(next) { state.token = next || DEFAULT_TOKEN }

  // Build the flat options list. Dashboard first; then every active service;
  // then each service's modules indented under it. Order mirrors what the
  // user sees in the dashboard sidebar so the picker isn't a guessing game.
  const options = computed(() => {
    const out = [{ value: 'dashboard', label: t('Dashboard'), depth: 0 }]
    for (const svc of services) {
      out.push({
        value: `service:${svc.id}`,
        label: t(svc.name),
        depth: 0,
      })
      // Skip modules of services whose routes embed the module inside the
      // service shell — see STANDALONE_MODULE_SERVICES.
      if (!STANDALONE_MODULE_SERVICES.has(svc.id)) continue
      const { modules } = useModuleLoader(svc.id)
      for (const mod of modules) {
        out.push({
          value: `module:${svc.id}:${mod.id}`,
          label: t(mod.name),
          depth: 1,
        })
      }
    }
    return out
  })

  function resolveAvailablePath() {
    if (isTokenAvailable(state.token, { services, isEnabled })) {
      return tokenToPath(state.token)
    }
    return '/'   // fallback when the saved target was disabled / removed
  }

  return {
    state,
    options,
    setToken,
    resolveAvailablePath,
    tokenToPath,
    isTokenAvailable: (token) => isTokenAvailable(token, { services, isEnabled }),
  }
}
