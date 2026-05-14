import { useFeatureFlags } from '../useFeatureFlags.js'

const allConfigs  = import.meta.glob('@/services/*/modules/*/module.json',     { eager: true })
const allCheckers = import.meta.glob('@/services/*/modules/*/index.js',         { eager: true })
const allViews    = import.meta.glob('@/services/*/modules/*/views/Index.vue', { eager: true })

// Merges module.json (static keys) with index.js exports (dynamic, e.g. overlay
// with functions). JSON wins on conflicts; JS is the fallback for older modules.
export function useModuleLoader(serviceId) {
  const { isEnabled } = useFeatureFlags()
  const modules = []

  for (const configPath in allConfigs) {
    const parts = configPath.split('/')
    const svcId = parts[parts.length - 4]
    const modId = parts[parts.length - 2]

    if (svcId !== serviceId) continue

    const config = allConfigs[configPath].default ?? allConfigs[configPath]
    if (!config.active) continue
    if (!isEnabled(`module.${svcId}.${modId}`)) continue

    const checkerModule = allCheckers[`/src/services/${svcId}/modules/${modId}/index.js`]
    const view          = allViews[`/src/services/${svcId}/modules/${modId}/views/Index.vue`]?.default

    if (!checkerModule || !view) {
      console.warn(`Module "${modId}" missing index.js or views/Index.vue`)
      continue
    }

    modules.push({
      ...config,
      id:            modId,
      checker:       checkerModule.default,
      checkOnReload: config.checkOnReload ?? checkerModule.checkOnReload ?? false,
      allowChatBot:  config.allowChatBot  ?? checkerModule.allowChatBot  ?? false,
      defaultFilter: config.defaultFilter ?? 'issues',
      overlay:       checkerModule.overlay   ?? null,
      apiConfig:     checkerModule.apiConfig ?? null,
      view,
    })
  }

  const withOrder    = modules.filter(m => m.order !== undefined).sort((a, b) => a.order - b.order)
  const withoutOrder = modules.filter(m => m.order === undefined)

  return { modules: [...withOrder, ...withoutOrder] }
}
