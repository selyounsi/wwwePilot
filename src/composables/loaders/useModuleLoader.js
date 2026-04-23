const allConfigs  = import.meta.glob('@/services/*/modules/*/module.json', { eager: true })
const allCheckers = import.meta.glob('@/services/*/modules/*/index.js',    { eager: true })
const allViews    = import.meta.glob('@/services/*/modules/*/Index.vue',   { eager: true })

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
      checkOnReload: checkerModule.checkOnReload ?? false,
      overlay:       checkerModule.overlay       ?? null,
      apiConfig:     checkerModule.apiConfig      ?? null,
      view,
    })
  }

  const withOrder    = modules.filter(m => m.order !== undefined).sort((a, b) => a.order - b.order)
  const withoutOrder = modules.filter(m => m.order === undefined)

  return { modules: [...withOrder, ...withoutOrder] }
}