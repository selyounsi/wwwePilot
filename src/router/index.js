import { createRouter, createWebHashHistory } from 'vue-router'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import DashboardView from '../views/DashboardView.vue'

const { services } = useServiceLoader()

// Service sub-views: SiteCheckView.vue → /service/<id>/site-check
// HomeView is the service root and registered separately.
const subViewModules = import.meta.glob('@/services/*/views/*View.vue', { eager: true })
const subViews = Object.entries(subViewModules)
  .map(([path, m]) => {
    const parts    = path.split('/')
    const fileName = parts[parts.length - 1].replace(/\.vue$/, '')
    if (fileName === 'HomeView') return null
    const slug     = fileName.replace(/View$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    return {
      serviceId: parts[parts.length - 3],
      slug,
      component: m.default,
    }
  })
  .filter(Boolean)

const serviceRoutes = services.flatMap(service => {
  const { modules } = useModuleLoader(service.id)

  return [
    {
      path: `/service/${service.id}`,
      name: service.id,
      component: service.view,
      meta: {
        serviceName:  service.name,
        description:  service.description,
        icon:         service.icon,
      },
    },
    ...modules.map(mod => ({
      path: `/service/${service.id}/module/${mod.id}`,
      name: `${service.id}-${mod.id}`,
      component: mod.view,
      meta: {
        serviceName:  service.name,
        serviceId:    service.id,
        moduleName:   mod.name,
        description:  mod.description,
        icon:         mod.icon,
      },
    })),
    ...subViews
      .filter(v => v.serviceId === service.id)
      .map(v => ({
        path: `/service/${service.id}/${v.slug}`,
        name: `${service.id}-${v.slug}`,
        component: v.component,
        meta: { serviceName: service.name, serviceId: service.id },
      })),
  ]
})

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    ...serviceRoutes,
  ],
})

export default router
