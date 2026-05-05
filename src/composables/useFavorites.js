import { reactive, computed } from 'vue'
import { createSettingsStore } from './settings/createSettingsStore.js'

const STORAGE_KEY = 'wp-favorites'

const state = reactive({
  ids: [],
})

function reset() {
  state.ids = []
}

const { hydrationPromise } = createSettingsStore(STORAGE_KEY, {
  state,
  version: 1,
  userScoped: true,
  resetToDefaults: reset,
  onHydrate(stored, s) {
    if (Array.isArray(stored?.ids)) s.ids = stored.ids
  },
  onSerialize(s) {
    return { ids: s.ids }
  },
})

function key(serviceId, moduleId) {
  return `${serviceId}:${moduleId}`
}

/** Resolves once the per-user favorites have been loaded from chrome.storage.local. */
export function whenFavoritesHydrated() {
  return hydrationPromise
}

/** Reactive favorites API, persisted per user under `wp-favorites:<userId>`. */
export function useFavorites() {
  const ids = computed(() => state.ids)

  function isFavorite(serviceId, moduleId) {
    return state.ids.includes(key(serviceId, moduleId))
  }

  function add(serviceId, moduleId) {
    const k = key(serviceId, moduleId)
    if (!state.ids.includes(k)) state.ids.push(k)
  }

  function remove(serviceId, moduleId) {
    const k = key(serviceId, moduleId)
    const i = state.ids.indexOf(k)
    if (i >= 0) state.ids.splice(i, 1)
  }

  function toggle(serviceId, moduleId) {
    if (isFavorite(serviceId, moduleId)) remove(serviceId, moduleId)
    else                                 add(serviceId, moduleId)
  }

  return { state, ids, isFavorite, add, remove, toggle }
}
