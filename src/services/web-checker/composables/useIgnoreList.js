import { reactive } from 'vue'
import { createSettingsStore } from '@/composables/settings/createSettingsStore.js'

const STORAGE_KEY = 'wp-ignored-issues'

const state = reactive({ byOrigin: {} })

createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  migrations: {},
  onHydrate(stored, s) {
    if (stored && typeof stored.byOrigin === 'object') s.byOrigin = stored.byOrigin
  },
  onSerialize(s) {
    return { byOrigin: s.byOrigin }
  },
})

export function useIgnoreList() {
  function listFor(origin, moduleId) {
    return state.byOrigin[origin]?.[moduleId] ?? []
  }
  function isIgnored(origin, moduleId, message) {
    return listFor(origin, moduleId).includes(message)
  }
  function add(origin, moduleId, message) {
    if (!origin || !moduleId || !message) return
    if (!state.byOrigin[origin])           state.byOrigin[origin] = {}
    if (!state.byOrigin[origin][moduleId]) state.byOrigin[origin][moduleId] = []
    const list = state.byOrigin[origin][moduleId]
    if (!list.includes(message)) list.push(message)
  }
  function remove(origin, moduleId, message) {
    const list = state.byOrigin[origin]?.[moduleId]
    if (!list) return
    const idx = list.indexOf(message)
    if (idx >= 0) list.splice(idx, 1)
    if (list.length === 0) delete state.byOrigin[origin][moduleId]
    if (Object.keys(state.byOrigin[origin] || {}).length === 0) delete state.byOrigin[origin]
  }
  function clearOrigin(origin) {
    delete state.byOrigin[origin]
  }
  return { state, listFor, isIgnored, add, remove, clearOrigin }
}
