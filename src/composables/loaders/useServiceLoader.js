const serviceConfigs = import.meta.glob('@/services/*/service.json',        { eager: true })
const serviceViews   = import.meta.glob('@/services/*/views/HomeView.vue',  { eager: true })

export function useServiceLoader() {
  const services = []

  for (const configPath in serviceConfigs) {
    const config = serviceConfigs[configPath].default ?? serviceConfigs[configPath]
    if (!config.active) continue

    const id   = configPath.split('/').slice(-2)[0]
    const view = serviceViews[`/src/services/${id}/views/HomeView.vue`]?.default

    if (!view) {
      console.warn(`⚠️ Service "${id}" fehlt views/HomeView.vue`)
      continue
    }

    services.push({ ...config, id, view })
  }

  const withOrder    = services.filter(s => s.order !== undefined).sort((a, b) => a.order - b.order)
  const withoutOrder = services.filter(s => s.order === undefined)

  return { services: [...withOrder, ...withoutOrder] }
}