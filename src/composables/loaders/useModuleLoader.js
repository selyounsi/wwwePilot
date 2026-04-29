const allConfigs  = import.meta.glob('@/services/*/modules/*/module.json', { eager: true })
const allCheckers = import.meta.glob('@/services/*/modules/*/index.js',    { eager: true })
const allViews    = import.meta.glob('@/services/*/modules/*/Index.vue',   { eager: true })

/**
 * Loads modules for a service, merging module.json config with the JS exports
 * from index.js. JSON keys win — JS exports are kept as a fallback so older
 * modules (or per-module dynamic config like overlay/labelFn) still work.
 *
 * Static config lives in module.json (checkOnReload, allowChatBot, defaultFilter).
 * Dynamic config lives in index.js (overlay with labelFn, apiConfig).
 */
export function useModuleLoader(serviceId) {
  const modules = []

  for (const configPath in allConfigs) {
    const parts = configPath.split('/')
    const svcId = parts[parts.length - 4]
    const modId = parts[parts.length - 2]

    if (svcId !== serviceId) continue

    const config = allConfigs[configPath].default ?? allConfigs[configPath]
    if (!config.active) continue

    const checkerModule = allCheckers[`/src/services/${svcId}/modules/${modId}/index.js`]
    const view          = allViews[`/src/services/${svcId}/modules/${modId}/Index.vue`]?.default

    if (!checkerModule || !view) {
      console.warn(`⚠️ Modul "${modId}" fehlt index.js oder Index.vue`)
      continue
    }

    modules.push({
      ...config,
      id:            modId,
      checker:       checkerModule.default,
      // static settings: prefer module.json, fall back to JS export, then default
      checkOnReload: config.checkOnReload ?? checkerModule.checkOnReload ?? false,
      allowChatBot:  config.allowChatBot  ?? checkerModule.allowChatBot  ?? false,
      defaultFilter: config.defaultFilter ?? 'issues',
      // dynamic settings stay in JS (cannot be JSON because they hold functions)
      overlay:       checkerModule.overlay   ?? null,
      apiConfig:     checkerModule.apiConfig ?? null,
      view,
    })
  }

  const withOrder    = modules.filter(m => m.order !== undefined).sort((a, b) => a.order - b.order)
  const withoutOrder = modules.filter(m => m.order === undefined)

  return { modules: [...withOrder, ...withoutOrder] }
}
