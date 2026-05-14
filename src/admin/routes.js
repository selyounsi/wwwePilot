import AdminLayout      from './views/AdminLayout.vue'
import DashboardView    from './views/DashboardView.vue'
import UsersView        from './views/UsersView.vue'
import RolesView        from './views/RolesView.vue'
import RunsView         from './views/RunsView.vue'
import RunDetailView    from './views/RunDetailView.vue'
import SitesView        from './views/SitesView.vue'
import SiteDetailView   from './views/SiteDetailView.vue'
import AuditView        from './views/AuditView.vue'
import SelectorsView    from './views/SelectorsView.vue'
import FeatureFlagsView from './views/FeatureFlagsView.vue'

/**
 * Admin route group. Mounted at /admin/* by the main router. Permission gating
 * is meta-driven so the global beforeEach can enforce uniformly — no per-route
 * guard duplication here.
 */
export const adminRoutes = [
  {
    path:      '/admin',
    component: AdminLayout,
    meta:      { requiresPermission: 'admin.access', layout: 'admin' },
    children:  [
      { path: '',                redirect: '/admin/dashboard' },
      { path: 'dashboard',       name: 'admin-dashboard',    component: DashboardView,    meta: { requiresPermission: 'admin.activity.read' } },
      { path: 'users',           name: 'admin-users',        component: UsersView,        meta: { requiresPermission: 'admin.users.read' } },
      { path: 'roles',           name: 'admin-roles',        component: RolesView,        meta: { requiresPermission: 'admin.users.read' } },
      { path: 'runs',            name: 'admin-runs',         component: RunsView,         meta: { requiresPermission: 'admin.activity.read' } },
      { path: 'runs/:id',        name: 'admin-run-detail',   component: RunDetailView,    meta: { requiresPermission: 'admin.activity.read' } },
      { path: 'sites',           name: 'admin-sites',        component: SitesView,        meta: { requiresPermission: 'admin.activity.read' } },
      { path: 'sites/:origin',   name: 'admin-site-detail',  component: SiteDetailView,   meta: { requiresPermission: 'admin.activity.read' } },
      { path: 'selectors',       name: 'admin-selectors',    component: SelectorsView,    meta: { requiresPermission: 'admin.selectors.write' } },
      { path: 'flags',           name: 'admin-flags',        component: FeatureFlagsView, meta: { requiresPermission: 'admin.features.write' } },
      { path: 'audit',           name: 'admin-audit',        component: AuditView,        meta: { requiresPermission: 'admin.audit.read' } },
    ],
  },
]
