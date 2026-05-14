import AdminLayout   from './views/AdminLayout.vue'
import UsersView     from './views/UsersView.vue'
import RolesView     from './views/RolesView.vue'
import ActivityView  from './views/ActivityView.vue'
import AuditView     from './views/AuditView.vue'
import SelectorsView from './views/SelectorsView.vue'

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
      { path: '',          redirect: '/admin/activity' },
      { path: 'users',     name: 'admin-users',     component: UsersView,     meta: { requiresPermission: 'admin.users.read' } },
      { path: 'roles',     name: 'admin-roles',     component: RolesView,     meta: { requiresPermission: 'admin.users.read' } },
      { path: 'activity',  name: 'admin-activity',  component: ActivityView,  meta: { requiresPermission: 'admin.activity.read' } },
      { path: 'selectors', name: 'admin-selectors', component: SelectorsView, meta: { requiresPermission: 'admin.selectors.write' } },
      { path: 'audit',     name: 'admin-audit',     component: AuditView,     meta: { requiresPermission: 'admin.audit.read' } },
    ],
  },
]
