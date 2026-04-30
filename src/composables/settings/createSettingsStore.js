import { effectScope, watch } from 'vue'

/**
 * Recovery-Heuristik für korrupte Storage-Inhalte: chrome.storage hat manche
 * reactive Arrays als `{0:'a',1:'b'}` Objects geschrieben. Erkennt sequentielle
 * numerische String-Keys ab "0" und wandelt zurück in echte Arrays um.
 */
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

/**
 * Plain-JSON Deep-Clone — entfernt Vue-Reactive-Proxies, damit
 * chrome.storage echte Arrays statt `{0,1,2…}`-Objects schreibt.
 */
export function toPlain(v) {
  return JSON.parse(JSON.stringify(v))
}

/**
 * Erstellt einen persistenten Settings-Store gegen `chrome.storage.local`.
 * Übernimmt Hydrate-on-Module-Load, Watch-with-Save in detached scope,
 * Multi-Tab-Sync via `chrome.storage.onChanged`, Schema-Versionierung mit
 * Migrations und Dev-Warnings bei Storage-Errors.
 *
 * @param {string} storageKey Eindeutiger Storage-Key
 * @param {{
 *   state: object,
 *   version?: number,
 *   migrations?: Record<number, (data: any) => any>,
 *   onHydrate: (stored: any, state: object) => void,
 *   onSerialize: (state: object) => any,
 * }} opts
 * @returns {{ hydrationPromise: Promise<void> }}
 */
export function createSettingsStore(storageKey, opts) {
  const {
    state,
    version     = 1,
    migrations  = {},
    onHydrate,
    onSerialize,
  } = opts

  let writingFromWatcher = false

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

  const hydrationPromise = (async () => {
    try {
      const r = await chrome.storage?.local?.get(storageKey)
      applyStored(r?.[storageKey])
    } catch (e) {
      console.warn(`[settings:${storageKey}] read failed`, e)
    }
  })()

  const scope = effectScope(true)
  scope.run(() => {
    watch(
      state,
      () => {
        if (writingFromWatcher) return
        try {
          const data = toPlain(onSerialize(state))
          chrome.storage?.local?.set({ [storageKey]: { __v: version, data } })
        } catch (e) {
          console.warn(`[settings:${storageKey}] save failed`, e)
        }
      },
      { deep: true },
    )
  })

  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !(storageKey in changes)) return
      const next = changes[storageKey].newValue
      writingFromWatcher = true
      try { applyStored(next) }
      finally {
        queueMicrotask(() => { writingFromWatcher = false })
      }
    })
  }

  return { hydrationPromise }
}
