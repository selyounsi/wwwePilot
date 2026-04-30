import { reactive } from 'vue'
import { createSettingsStore } from './createSettingsStore.js'

const STORAGE_KEY = 'wp-module-settings'

const state = reactive({})

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  migrations: {},
  onHydrate(stored, state) {
    if (!stored || typeof stored !== 'object') return
    for (const [k, v] of Object.entries(stored)) {
      if (state[k] === undefined) state[k] = v
      else state[k] = { ...state[k], ...v }
    }
  },
  onSerialize(state) {
    return state
  },
})

/**
 * Reactive Settings-Slice für ein Modul. Beim ersten Aufruf wird der Slot mit
 * `defaults` befüllt; bei späteren Aufrufen werden nur fehlende Keys ergänzt
 * (forward-compat für neue Defaults). Bei Type-Mismatch (z.B. korruptes
 * Storage-Object wo ein Array erwartet wird) wird der Default eingesetzt.
 * Mutationen am Rückgabewert werden automatisch nach `chrome.storage.local`
 * persistiert.
 *
 * @param {string} moduleId   Eindeutige Modul-ID (Namespace im Store)
 * @param {object} [defaults] Default-Werte für neue Keys
 * @returns {object} reactive Settings-Objekt für das Modul
 */
export function useModuleSettings(moduleId, defaults = {}) {
  if (!state[moduleId]) {
    state[moduleId] = { ...defaults }
  } else {
    for (const k of Object.keys(defaults)) {
      const cur = state[moduleId][k]
      const def = defaults[k]
      if (cur === undefined || isTypeMismatch(def, cur)) state[moduleId][k] = def
    }
  }
  return state[moduleId]
}

function isTypeMismatch(def, cur) {
  if (def === null || def === undefined) return false
  if (Array.isArray(def))         return !Array.isArray(cur)
  if (typeof def === 'object')    return cur === null || typeof cur !== 'object' || Array.isArray(cur)
  if (typeof def === 'number')    return typeof cur !== 'number' || Number.isNaN(cur)
  if (typeof def === 'boolean')   return typeof cur !== 'boolean'
  if (typeof def === 'string')    return typeof cur !== 'string'
  return false
}

/**
 * Tiefer Snapshot aller Modul-Settings — wird vom Web-Checker-Runner ins
 * Page-Context als `window.__moduleSettings` injiziert.
 *
 * @returns {object} plain Object, JSON-clone des Stores
 */
export function getAllModuleSettings() {
  return JSON.parse(JSON.stringify(state))
}

/**
 * Promise, die resolved sobald die initiale `chrome.storage.local`-Hydration
 * abgeschlossen ist. Für Codepfade, die garantiert auf persistente Werte
 * zugreifen wollen, bevor sie laufen.
 *
 * @returns {Promise<void>}
 */
export function whenModuleSettingsHydrated() {
  return hydrationPromise
}
