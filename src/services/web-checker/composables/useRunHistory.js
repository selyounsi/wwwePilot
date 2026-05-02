import { reactive } from 'vue'
import { createSettingsStore } from '@/composables/settings/createSettingsStore.js'

const STORAGE_KEY = 'wp-run-history'
const MAX_PER_KEY = 30

const state = reactive({ byKey: {} })

createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  migrations: {},
  onHydrate(stored, s) {
    if (stored && typeof stored.byKey === 'object') s.byKey = stored.byKey
  },
  onSerialize(s) {
    return { byKey: s.byKey }
  },
})

function makeKey(origin, moduleId) {
  return `${origin}::${moduleId}`
}

export function useRunHistory() {
  function record(origin, moduleId, result) {
    if (!origin || !moduleId || !result) return
    const key  = makeKey(origin, moduleId)
    const list = state.byKey[key] ?? []
    const last = list[list.length - 1]
    const entry = {
      timestamp: Date.now(),
      errorCount:   result.errorCount   ?? 0,
      warningCount: result.warningCount ?? 0,
      itemCount:    result.items?.length ?? 0,
    }
    if (last && last.errorCount === entry.errorCount && last.warningCount === entry.warningCount) {
      last.timestamp = entry.timestamp
      last.itemCount = entry.itemCount
    } else {
      list.push(entry)
      if (list.length > MAX_PER_KEY) list.splice(0, list.length - MAX_PER_KEY)
    }
    state.byKey[key] = list
  }
  function get(origin, moduleId) {
    return state.byKey[makeKey(origin, moduleId)] ?? []
  }
  function clear(origin, moduleId) {
    if (origin && moduleId) delete state.byKey[makeKey(origin, moduleId)]
    else if (origin) {
      Object.keys(state.byKey).forEach(k => {
        if (k.startsWith(origin + '::')) delete state.byKey[k]
      })
    }
  }
  return { state, record, get, clear }
}
