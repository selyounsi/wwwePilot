import { reactive, watch } from 'vue'
import { createSettingsStore } from './createSettingsStore.js'

const STORAGE_KEY = 'wp-ui-settings'

// Zoom is stored as a percentage (100 = 100%). Applied to <html> via the
// CSS `zoom` property — that scales *everything* (rem, px, em, images, …)
// uniformly, unlike a root font-size which only affects rem-based utilities
// and leaves arbitrary px values (`text-[11px]`, inline styles, icon sizes)
// stuck at their literal size.
const ZOOM_MIN     = 50
const ZOOM_MAX     = 200
const ZOOM_STEP    = 10
const ZOOM_DEFAULT = 100

const state = reactive({
  zoom: ZOOM_DEFAULT,
})

function clampZoom(v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return ZOOM_DEFAULT
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n))
}

function applyZoom(percent) {
  if (typeof document === 'undefined') return
  document.documentElement.style.zoom = (percent / 100).toString()
}

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 2,
  migrations: {
    // v1 used named levels ('sm'|'md'|'lg'|'xl'); v2 stores a percentage.
    2: (data) => {
      if (!data || typeof data !== 'object') return data
      if (typeof data.zoom === 'string') {
        const map = { sm: 80, md: 100, lg: 115, xl: 130 }
        return { ...data, zoom: map[data.zoom] ?? ZOOM_DEFAULT }
      }
      return data
    },
  },
  onHydrate(stored, state) {
    if (!stored || typeof stored !== 'object') return
    if (typeof stored.zoom === 'number') state.zoom = clampZoom(stored.zoom)
  },
  onSerialize(state) {
    return { zoom: state.zoom }
  },
})

watch(() => state.zoom, (level) => applyZoom(level), { immediate: true })

// Keyboard shortcuts: Ctrl/Cmd ± / 0 zoom *only* the sidebar. preventDefault
// stops Chrome's browser-wide zoom from also firing — user explicitly asked
// for sidebar-isolated zoom and the native shortcut would compound the effect.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return
    if (e.altKey) return

    const k = e.key
    let next = null
    if (k === '+' || k === '=') next = clampZoom(state.zoom + ZOOM_STEP)
    else if (k === '-')         next = clampZoom(state.zoom - ZOOM_STEP)
    else if (k === '0')         next = ZOOM_DEFAULT
    if (next === null) return

    e.preventDefault()
    e.stopPropagation()
    state.zoom = next
  }, { capture: true })
}

/**
 * Promise, die resolved sobald die persistierten UI-Settings aus
 * `chrome.storage.local` geladen wurden.
 *
 * @returns {Promise<void>}
 */
export function whenUiSettingsHydrated() {
  return hydrationPromise
}

/**
 * Globale UI-Einstellungen (aktuell: Zoom in Prozent). Singleton, persistiert
 * in `chrome.storage.local` unter `wp-ui-settings`. Skaliert nur die Sidebar
 * über `<html>.style.fontSize`, nicht den Browser-Zoom — Strg+/- bleiben dem
 * Browser vorbehalten.
 *
 * @returns {{
 *   state: object,
 *   min: number, max: number, step: number, default: number,
 *   setZoom:       (percent: number) => void,
 *   incrementZoom: () => void,
 *   decrementZoom: () => void,
 *   resetZoom:     () => void,
 * }}
 */
export function useUiSettings() {
  function setZoom(percent) {
    state.zoom = clampZoom(percent)
  }

  function incrementZoom() { setZoom(state.zoom + ZOOM_STEP) }
  function decrementZoom() { setZoom(state.zoom - ZOOM_STEP) }
  function resetZoom()     { setZoom(ZOOM_DEFAULT) }

  return {
    state,
    min:     ZOOM_MIN,
    max:     ZOOM_MAX,
    step:    ZOOM_STEP,
    default: ZOOM_DEFAULT,
    setZoom, incrementZoom, decrementZoom, resetZoom,
  }
}
