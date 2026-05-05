import { effectScope, watch } from 'vue'
import { useAuth, whenAuthHydrated } from '../auth/useAuth.js'

/** Converts corrupt `{0:'a',1:'b'}` objects from chrome.storage back into arrays. */
export function reviveArrays(v) {
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(reviveArrays)
  const keys = Object.keys(v)
  if (keys.length > 0 && keys.every((k, i) => k === String(i))) {
    return keys.map(k => reviveArrays(v[k]))
  }
  const out = {}
  for (const k of keys) out[k] = reviveArrays(v[k])
  return out
}

/** Deep clone via JSON — strips Vue reactive proxies before persisting. */
export function toPlain(v) {
  return JSON.parse(JSON.stringify(v))
}

/**
 * Persisted, reactive settings store backed by `chrome.storage.local`. With
 * `userScoped: true` the key is suffixed per user (`<key>:<userId>`) and
 * `resetToDefaults()` re-hydrates on user switch.
 *
 * @param {string} storageKey
 * @param {{
 *   state: object,
 *   version?: number,
 *   migrations?: Record<number, (data: any) => any>,
 *   onHydrate: (stored: any, state: object) => void,
 *   onSerialize: (state: object) => any,
 *   userScoped?: boolean,
 *   resetToDefaults?: () => void,
 * }} opts
 * @returns {{ hydrationPromise: Promise<void> }}
 */
export function createSettingsStore(storageKey, opts) {
  const {
    state,
    version          = 1,
    migrations       = {},
    onHydrate,
    onSerialize,
    userScoped       = false,
    resetToDefaults  = null,
  } = opts

  let writingFromWatcher = false
  let currentKey         = userScoped ? null : storageKey

  function resolveKey(userId) {
    if (!userScoped) return storageKey
    return userId ? `${storageKey}:${userId}` : `${storageKey}:guest`
  }

  function applyStored(rawStored) {
    if (rawStored === undefined || rawStored === null) return

    let payload  = rawStored
    let storedV  = 0

    if (typeof rawStored === 'object' && !Array.isArray(rawStored) && '__v' in rawStored && 'data' in rawStored) {
      storedV = Number(rawStored.__v) || 0
      payload = rawStored.data
    }

    let cur = storedV
    while (cur < version) {
      const next = cur + 1
      const migrate = migrations[next]
      if (typeof migrate === 'function') {
        try { payload = migrate(payload) }
        catch (e) { console.warn(`[settings:${storageKey}] migration v${next} failed`, e) }
      }
      cur = next
    }

    const revived = reviveArrays(payload)
    try { onHydrate(revived, state) }
    catch (e) { console.warn(`[settings:${storageKey}] hydrate failed`, e) }
  }

  async function hydrateFor(key) {
    currentKey = key
    try {
      const r = await chrome.storage?.local?.get(key)
      writingFromWatcher = true
      try { applyStored(r?.[key]) }
      finally { queueMicrotask(() => { writingFromWatcher = false }) }
    } catch (e) {
      console.warn(`[settings:${key}] read failed`, e)
    }
  }

  const hydrationPromise = (async () => {
    if (!userScoped) {
      await hydrateFor(storageKey)
      return
    }
    await whenAuthHydrated()
    const auth = useAuth()
    await hydrateFor(resolveKey(auth.state.user?.id))

    const switchScope = effectScope(true)
    switchScope.run(() => {
      watch(() => auth.state.user?.id, async (newId, oldId) => {
        if (newId === oldId) return
        if (resetToDefaults) {
          writingFromWatcher = true
          try { resetToDefaults() }
          finally { queueMicrotask(() => { writingFromWatcher = false }) }
        }
        await hydrateFor(resolveKey(newId))
      })
    })
  })()

  const scope = effectScope(true)
  scope.run(() => {
    watch(
      state,
      () => {
        if (writingFromWatcher) return
        if (!currentKey) return
        try {
          const data = toPlain(onSerialize(state))
          chrome.storage?.local?.set({ [currentKey]: { __v: version, data } })
        } catch (e) {
          console.warn(`[settings:${currentKey}] save failed`, e)
        }
      },
      { deep: true },
    )
  })

  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !currentKey) return
      if (!(currentKey in changes)) return
      const next = changes[currentKey].newValue
      writingFromWatcher = true
      try { applyStored(next) }
      finally {
        queueMicrotask(() => { writingFromWatcher = false })
      }
    })
  }

  return { hydrationPromise }
}
