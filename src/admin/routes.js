import AdminLayout from './AdminLayout.vue'

// Each module is a black box described by its `module.json`:
//   {
//     "key":        "<unique>",
//     "enabled":    true,           ← false hides the whole module
//     "permission": "<default>",    ← used as fallback for nav + routes
//     "nav":        { order, icon, label, badge? },
//     "routes":     [ { path, name, view, permission? } ]
//   }
//
// Views are resolved by convention: `view: "Index"` maps to
// `modules/<key>/views/Index.vue`. Adding a module = drop a folder with
// `module.json` + `views/` and it's picked up on the next build.
const configs = Object.entries(import.meta.glob('./modules/*/module.json', { eager: true }))
const views   = import.meta.glob('./modules/*/views/*.vue',                  { eager: true })

const moduleRoutes = []
const navItems     = []

for (const [cfgPath, mod] of configs) {
  const conf = mod.default ?? mod
  if (conf.enabled === false) continue

  const baseDir = cfgPath.replace(/\/module\.json$/, '')
  for (const r of conf.routes ?? []) {
    const viewModule = views[`${baseDir}/views/${r.view}.vue`]
    if (!viewModule) {
      console.warn(`[admin] missing view "${r.view}" for module "${conf.key}" (expected ${baseDir}/views/${r.view}.vue)`)
      continue
    }
    moduleRoutes.push({
      path:      r.path,
      name:      r.name,
      component: viewModule.default,
      meta:      { requiresPermission: r.permission ?? conf.permission },
    })
  }

  if (conf.nav) {
    const firstRoute = conf.routes?.[0]?.path
    navItems.push({
      key:        conf.key,
      path:       firstRoute ? `/admin/${firstRoute}` : `/admin/${conf.key}`,
      icon:       conf.nav.icon,
      label:      conf.nav.label,
      order:      conf.nav.order ?? 999,
      badge:      conf.nav.badge ?? null,
      permission: conf.nav.permission ?? conf.permission,
    })
  }
}

/**
 * Sidebar nav metadata, sorted by `nav.order`. Filtering by permission and
 * resolving badges happens in `AdminLayout.vue`.
 */
export const adminNav = navItems.sort((a, b) => a.order - b.order)

/**
 * Admin route group. Mounted at /admin/* by the main router. Permission gating
 * is meta-driven so the global beforeEach can enforce uniformly.
 */
export const adminRoutes = [
  {
    path:      '/admin',
    component: AdminLayout,
    meta:      { requiresPermission: 'admin.access', layout: 'admin' },
    children:  [
      { path: '', redirect: '/admin/dashboard' },
      ...moduleRoutes,
    ],
  },
]
