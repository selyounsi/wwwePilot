import { ref } from 'vue'

const SUPPORTED   = ['en', 'de']
const STORAGE_KEY = 'wp-lang'

const lang = ref('en')

const allFiles = {
  ...import.meta.glob('@/translations/translations.json',                          { eager: true }),
  ...import.meta.glob('@/admin/translations.json',                                 { eager: true }),
  ...import.meta.glob('@/admin/modules/*/translations/translations.json',          { eager: true }),
  ...import.meta.glob('@/services/*/translations/translations.json',               { eager: true }),
  ...import.meta.glob('@/services/*/modules/*/translations/translations.json',     { eager: true }),
}

const merged = {}
for (const path in allFiles) {
  const data = allFiles[path].default ?? allFiles[path]
  for (const lng in data) {
    if (!merged[lng]) merged[lng] = {}
    Object.assign(merged[lng], data[lng])
  }
}

const hydrationPromise = (async () => {
  try {
    const r = await chrome.storage?.local?.get(STORAGE_KEY)
    const stored = r?.[STORAGE_KEY]
    if (SUPPORTED.includes(stored)) lang.value = stored
  } catch (e) {
    console.warn('[i18n] read failed', e)
  }
})()

if (chrome.storage?.onChanged?.addListener) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return
    const next = changes[STORAGE_KEY].newValue
    if (SUPPORTED.includes(next) && next !== lang.value) lang.value = next
  })
}

/**
 * Setzt die aktive Sprache und persistiert sie in `chrome.storage.local`.
 * No-op bei nicht unterstützter Sprache.
 *
 * @param {'en' | 'de'} next
 */
function setLang(next) {
  if (!SUPPORTED.includes(next)) return
  lang.value = next
  try { chrome.storage?.local?.set({ [STORAGE_KEY]: next }) }
  catch (e) { console.warn('[i18n] save failed', e) }
}

function interpolate(str, params) {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`)
}

/**
 * Promise, die resolved sobald die persistierte Sprache aus
 * `chrome.storage.local` geladen wurde.
 *
 * @returns {Promise<void>}
 */
export function whenI18nHydrated() {
  return hydrationPromise
}

/**
 * Reaktive i18n-API. `lang` ist ein Ref — Änderungen propagieren live, alle
 * `t()`-Aufrufe re-evaluieren automatisch.
 *
 * @returns {{
 *   lang: import('vue').Ref<'en' | 'de'>,
 *   setLang: (next: 'en' | 'de') => void,
 *   t: (key: string, params?: Record<string, any>) => string,
 *   getTable: () => Record<string, string>,
 *   supportedLangs: readonly string[],
 * }}
 */
export function useI18n() {
  /**
   * Lookup für einen Translation-Key in der aktuellen Sprache. Fallback-Kette:
   * `merged[lang][key] → merged.en[key] → key`. Platzhalter im `{name}`-Stil
   * werden via `params` ersetzt.
   */
  function t(key, params) {
    const tr = merged[lang.value]?.[key] ?? merged.en?.[key] ?? key
    return interpolate(tr, params)
  }

  /**
   * Merged Tabelle für die aktuelle Sprache (en-Werte füllen Lücken). Wird in
   * den Page-Kontext injiziert, damit Modul-Checker via `window.__t()`
   * übersetzen können.
   */
  function getTable() {
    return { ...(merged.en ?? {}), ...(merged[lang.value] ?? {}) }
  }

  return { lang, setLang, t, getTable, supportedLangs: SUPPORTED }
}
