import { computed } from 'vue'
import { useAuth } from './auth/useAuth.js'

/**
 * Reactive permission checks against the current user's JWT-derived
 * `appPermissions` + `isSuperAdmin` flag. Mirrors backend's hasPermission().
 */
export function usePermissions() {
  const { state } = useAuth()

  function has(slug) {
    const u = state.user
    if (!u) return false
    if (u.isSuperAdmin === true) return true
    const perms = u.appPermissions ?? []
    if (perms.includes('*')) return true
    return perms.includes(slug)
  }

  const isSuperAdmin   = computed(() => state.user?.isSuperAdmin === true)
  const canAccessAdmin = computed(() => has('admin.access'))
  const canReadUsers   = computed(() => has('admin.users.read'))
  const canWriteUsers  = computed(() => has('admin.users.write'))
  const canWriteRoles  = computed(() => has('admin.roles.write'))
  const canReadActivity = computed(() => has('admin.activity.read'))
  const canReadAudit   = computed(() => has('admin.audit.read'))
  const canWriteSelectors = computed(() => has('admin.selectors.write'))

  return {
    has,
    isSuperAdmin,
    canAccessAdmin,
    canReadUsers,
    canWriteUsers,
    canWriteRoles,
    canReadActivity,
    canReadAudit,
    canWriteSelectors,
  }
}
