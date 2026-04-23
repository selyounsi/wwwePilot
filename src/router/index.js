import { createRouter, createWebHashHistory } from 'vue-router'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import DashboardView from '../views/DashboardView.vue'

const { services } = useServiceLoader()

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