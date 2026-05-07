import { reactive, computed } from 'vue'
import { createSettingsStore } from './settings/createSettingsStore.js'

const state = reactive({ path: '' })

const { hydrationPromise } = createSettingsStore('wp-extension-path', {
  state,
  version: 1,
  onHydrate(stored, s) { if (stored?.path) s.path = stored.path },
  onSerialize(s) { return { path: s.path } },
})

export function whenExtensionPathHydrated() { return hydrationPromise }

export function useExtensionPath() {
  return {
    state,
    path:    computed(() => state.path),
    hasPath: computed(() => !!state.path?.trim()),
    setPath(p) { state.path = (p ?? '').trim() },
    clear()    { state.path = '' },
  }
}
