<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useAuth }         from '@/composables/auth/useAuth.js'
import { usePermissions }  from '@/composables/usePermissions.js'
import { useAdminReports } from '@/admin/modules/reports/composables/useAdminReports.js'
import { useAdminRoles }   from '@/admin/modules/roles/composables/useAdminRoles.js'
import { adminNav }        from '@/admin/routes.js'

const router = useRouter()
const route  = useRoute()
const { t }  = useI18n()
const { state: authState } = useAuth()
const { has, isSuperAdmin } = usePermissions()

// Reports module opts into a sidebar badge — we resolve the live value here
// without polluting other modules. New badges should be added in this map
// with their own resolver. The data source stays inside the module's
// composable; this layout just stitches it onto the nav row.
const { state: reportsState, fetchCounts: fetchReportCounts } = useAdminReports()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()

const badgeResolvers = {
  openReports: () => (reportsState.counts?.open ?? 0) + (reportsState.counts?.investigating ?? 0),
}

const canReadReports = computed(() => has('admin.reports.read'))
const canReadRoles   = computed(() => has('admin.users.read'))

let pollTimer = null
onMounted(() => {
  if (canReadReports.value) {
    fetchReportCounts()
    // Poll every 60s — cheap GROUP BY on an indexed status column, no need to
    // be more frequent. Resets when admin tab is reloaded.
    pollTimer = setInterval(fetchReportCounts, 60_000)
  }
  if (canReadRoles.value && !rolesState.roles.length) fetchRoles()
})
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const navItems = computed(() => adminNav
  .filter(n => !n.permission || has(n.permission))
  .map(n => {
    const badge = n.badge ? (badgeResolvers[n.badge]?.() ?? null) : null
    return {
      key:   n.key,
      path:  n.path,
      icon:  n.icon,
      name:  t(n.label),
      badge: badge > 0 ? badge : null,
    }
  }))

const isActive = (path) => route.path === path || route.path.startsWith(path + '/')

const version = chrome.runtime?.getManifest?.()?.version ?? ''

// `window` isn't auto-bound in Vue's template scope — calling `window.close()`
// directly from `@click` throws "Cannot read properties of undefined". Wrap
// it in a script-setup function so the template just calls the function.
function closeTab() {
  window.close()
}

const displayName = computed(() => {
  const u = authState.user
  if (!u) return ''
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email || ''
})

const roleLabels = computed(() => {
  if (isSuperAdmin.value) return [t('Superadmin')]
  const ids = authState.user?.roles ?? []
  if (!ids.length) return []
  // Best-effort: prefer the human name from the role catalog when loaded,
  // otherwise fall back to the slug so we don't render an empty section
  // before the catalog hydrates.
  return ids.map(id => rolesState.roles.find(r => r.id === id)?.name ?? id)
})
</script>

<template>
  <div class="h-screen bg-background flex overflow-hidden">
    <aside class="w-64 bg-surface-soft border-r border-border flex flex-col shrink-0 h-screen">
      <div class="px-5 py-4 border-b border-border shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="mdiShieldCrownOutline" :size="20" class="text-primary shrink-0" />
          <h1 class="text-lg font-bold leading-tight truncate flex-1">{{ t('Backend') }}</h1>
          <span v-if="version" class="text-[10px] font-mono text-muted/70 shrink-0">v{{ version }}</span>
        </div>
        <div class="flex items-center gap-2">
          <p class="text-xs text-light truncate flex-1 min-w-0">{{ displayName }}</p>
          <span
            v-for="r in roleLabels" :key="r"
            class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0"
          >{{ r }}</span>
        </div>
      </div>

      <nav class="flex-1 px-2 py-3 overflow-y-auto min-h-0">
        <button
          v-for="item in navItems" :key="item.key"
          @click="router.push(item.path)"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
          :class="isActive(item.path)
            ? 'bg-primary text-black/80 font-semibold'
            : 'text-light hover:bg-surface-soft-hover'"
        >
          <Icon :name="item.icon" :size="16" />
          <span class="text-sm flex-1">{{ item.name }}</span>
          <span
            v-if="item.badge"
            class="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full min-w-5 text-center"
            :class="isActive(item.path)
              ? 'bg-black/20 text-black/80'
              : 'bg-error/20 text-error'"
          >{{ item.badge }}</span>
        </button>
      </nav>

      <div class="px-3 py-3 border-t border-border shrink-0">
        <BaseButton
          variant="ghost"
          icon="mdiClose"
          :icon-size="13"
          class="text-xs! py-2!"
          @click="closeTab"
        >
          {{ t('Close admin tab') }}
        </BaseButton>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto h-screen">
      <RouterView />
    </main>
  </div>
</template>
