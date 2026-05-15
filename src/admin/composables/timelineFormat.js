/**
 * Maps a timeline item's `kind` to display data: icon, accent color, message
 * key, and optional route. Keeps the bell + dashboard activity stream
 * visually consistent and translatable.
 *
 * Unknown kinds fall through to a generic audit/event message — better to
 * show *something* than swallow new event types silently.
 */

function actorName(item) {
  return item.actor?.name ?? item.actor?.email ?? '—'
}

export function describeItem(item, t) {
  const actor = actorName(item)
  const id    = item.target?.id

  switch (item.kind) {
    case 'report.new':
      return {
        icon:    'mdiBugOutline',
        color:   'text-error',
        message: t('{user} submitted a report: “{title}”', { user: actor, title: item.data?.title ?? '' }),
        route:   id ? { name: 'admin-report-detail', params: { id } } : null,
      }
    case 'audit.report.update':
      return {
        icon:    'mdiPencilOutline',
        color:   'text-primary',
        message: t('{user} updated a report', { user: actor }),
        route:   id ? { name: 'admin-report-detail', params: { id } } : null,
      }
    case 'audit.report.delete':
      return {
        icon:    'mdiDeleteOutline',
        color:   'text-error',
        message: t('{user} deleted a report', { user: actor }),
        route:   null,
      }
    case 'audit.user.suspend':
      return { icon: 'mdiAccountCancelOutline', color: 'text-error',  message: t('{user} suspended a user', { user: actor }), route: id ? { name: 'admin-user-detail', params: { id } } : null }
    case 'audit.user.unsuspend':
      return { icon: 'mdiAccountCheckOutline',  color: 'text-success', message: t('{user} reactivated a user', { user: actor }), route: id ? { name: 'admin-user-detail', params: { id } } : null }
    case 'audit.user.delete':
      return { icon: 'mdiAccountRemoveOutline', color: 'text-error',  message: t('{user} deleted a user', { user: actor }), route: null }
    case 'audit.user.update':
      return { icon: 'mdiAccountEditOutline',   color: 'text-primary', message: t('{user} edited a user', { user: actor }), route: id ? { name: 'admin-user-detail', params: { id } } : null }
    case 'audit.role.create':
    case 'audit.role.update':
    case 'audit.role.delete':
      return { icon: 'mdiShieldKeyOutline', color: 'text-primary', message: t('{user} changed a role', { user: actor }), route: { name: 'admin-roles' } }
    case 'audit.selector.add':
    case 'audit.selector.update':
    case 'audit.selector.delete':
    case 'audit.selector.reseed':
      return { icon: 'mdiFilterVariant', color: 'text-primary', message: t('{user} changed an ignore-selector', { user: actor }), route: { name: 'admin-selectors' } }
    case 'audit.feature_flag.toggle':
      return { icon: 'mdiToggleSwitchOutline', color: 'text-primary', message: t('{user} toggled a feature flag', { user: actor }), route: { name: 'admin-flags' } }
    case 'audit.run.delete':
      return { icon: 'mdiDeleteOutline', color: 'text-error', message: t('{user} deleted a run', { user: actor }), route: null }
    case 'audit.site.delete':
      return { icon: 'mdiWebOff', color: 'text-error', message: t('{user} purged a site', { user: actor }), route: null }
    case 'audit.build.trigger':
      return { icon: 'mdiPackageVariantClosed', color: 'text-alert', message: t('{user} triggered an extension build', { user: actor }), route: { name: 'admin-system' } }
    case 'audit.backup.create':
      return { icon: 'mdiDatabaseArrowDownOutline', color: 'text-success', message: t('{user} created a DB backup', { user: actor }), route: { name: 'admin-system' } }
    case 'audit.backup.delete':
      return { icon: 'mdiDatabaseRemoveOutline',    color: 'text-error',   message: t('{user} deleted a DB backup', { user: actor }), route: { name: 'admin-system' } }
    case 'audit.dashboard.refresh':
      return { icon: 'mdiRefresh', color: 'text-muted', message: t('{user} refreshed the dashboard', { user: actor }), route: { name: 'admin-dashboard' } }
    case 'auth.login.oidc':
    case 'auth.login.stub':
      return { icon: 'mdiLoginVariant', color: 'text-muted', message: t('{user} logged in', { user: actor }), route: null }
    default:
      // Unknown audit event — at least show the action name so admins can
      // see something happened without us shipping a label for every
      // possible event up front.
      return {
        icon:    'mdiCircleSmall',
        color:   'text-muted',
        message: t('{user} · {action}', { user: actor, action: item.kind }),
        route:   null,
      }
  }
}

export function relativeTime(iso, t) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return t('just now')
  if (min < 60) return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)   return t('{n} h ago',   { n: h })
  const d = Math.floor(h / 24)
  if (d < 30)   return t('{n} d ago',   { n: d })
  return new Date(iso).toLocaleDateString()
}
