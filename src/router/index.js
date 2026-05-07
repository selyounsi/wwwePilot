import { createRouter, createWebHashHistory } from 'vue-router'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useAuth } from '@/composables/auth/useAuth.js'
import DashboardView from '../views/DashboardView.vue'
import SettingsView  from '../views/SettingsView.vue'
import UpdatesView   from '../views/UpdatesView.vue'
import LoginView     from '../views/LoginView.vue'

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

// Module sub-views: modules/<mid>/views/SettingsView.vue → /service/<sid>/module/<mid>/settings
// Index.vue is the module root and mounted via useModuleLoader.
const moduleSubViewModules = import.meta.glob('@/services/*/modules/*/views/*View.vue', { eager: true })
const moduleSubViews = Object.entries(moduleSubViewModules)
  .map(([path, m]) => {
    const parts    = path.split('/')
    const fileName = parts[parts.length - 1].replace(/\.vue$/, '')
    if (fileName === 'Index') return null
    const slug     = fileName.replace(/View$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    return {
      serviceId: parts[parts.length - 5],
      moduleId:  parts[parts.length - 3],
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
    ...modules.flatMap(mod => [
      {
        path: `/service/${service.id}/module/${mod.id}`,
        name: `${service.id}-${mod.id}`,
        component: mod.view,
        meta: {
          serviceName:  service.name,
          serviceId:    service.id,
          moduleName:   mod.name,
          moduleId:     mod.id,
          description:  mod.description,
          icon:         mod.icon,
        },
      },
      ...moduleSubViews
        .filter(v => v.serviceId === service.id && v.moduleId === mod.id)
        .map(v => ({
          path: `/service/${service.id}/module/${mod.id}/${v.slug}`,
          name: `${service.id}-${mod.id}-${v.slug}`,
          component: v.component,
          meta: {
            serviceName:       service.name,
            serviceId:         service.id,
            moduleName:        mod.name,
            moduleId:          mod.id,
            icon:              mod.icon,
            isModuleSettings:  v.slug === 'settings',
          },
        })),
    ]),
    ...subViews
      .filter(v => v.serviceId === service.id)
      .map(v => ({
        path: `/service/${service.id}/${v.slug}`,
        name: `${service.id}-${v.slug}`,
        component: v.component,
        meta: {
          serviceName:        service.name,
          serviceId:          service.id,
          isServiceSettings:  v.slug === 'settings',
        },
      })),
  ]
})

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login',    name: 'login',     component: LoginView,     meta: { public: true } },
    { path: '/',         name: 'dashboard', component: DashboardView },
    { path: '/settings', name: 'settings',  component: SettingsView,  meta: { settingsRoot: true } },
    { path: '/updates',  name: 'updates',   component: UpdatesView },
    ...serviceRoutes,
  ],
})

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth()
  if (to.meta.public) {
    if (isAuthenticated.value && to.name === 'login') return { path: '/' }
    return true
  }
  if (!isAuthenticated.value) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }
  return true
})

export default router
