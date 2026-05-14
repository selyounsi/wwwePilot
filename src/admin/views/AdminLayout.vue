<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useAuth }         from '@/composables/auth/useAuth.js'
import { usePermissions }  from '@/composables/usePermissions.js'

const router = useRouter()
const route  = useRoute()
const { t }  = useI18n()
const { state: authState } = useAuth()
const {
  canReadUsers,
  canReadActivity,
  canReadAudit,
  canWriteSelectors,
  has,
} = usePermissions()

const canWriteFeatures = computed(() => has('admin.features.write'))

const navItems = computed(() => [
  { key: 'dashboard', name: t('Dashboard'),         icon: 'mdiViewDashboardOutline',   path: '/admin/dashboard', show: canReadActivity.value },
  { key: 'users',     name: t('Users'),             icon: 'mdiAccountMultipleOutline', path: '/admin/users',     show: canReadUsers.value },
  { key: 'roles',     name: t('Roles'),             icon: 'mdiShieldKeyOutline',       path: '/admin/roles',     show: canReadUsers.value },
  { key: 'activity',  name: t('Activity'),          icon: 'mdiPulse',                  path: '/admin/activity',  show: canReadActivity.value },
  { key: 'selectors', name: t('Ignore selectors'),  icon: 'mdiFilterVariant',          path: '/admin/selectors', show: canWriteSelectors.value },
  { key: 'flags',     name: t('Feature flags'),     icon: 'mdiToggleSwitchOutline',    path: '/admin/flags',     show: canWriteFeatures.value },
  { key: 'audit',     name: t('Audit'),             icon: 'mdiHistory',                path: '/admin/audit',     show: canReadAudit.value },
].filter(i => i.show))

const isActive = (path) => route.path === path || route.path.startsWith(path + '/')
const displayName = computed(() => {
  const u = authState.user
  if (!u) return ''
  return u.firstName || u.name || u.email || ''
})
</script>

<template>
  <div class="min-h-screen bg-background flex">
    <aside class="w-64 bg-surface-soft border-r border-border flex flex-col shrink-0">
      <div class="px-5 py-5 border-b border-border">
        <div class="flex items-center gap-2">
          <Icon name="mdiShieldCrownOutline" :size="22" class="text-primary" />
          <h1 class="text-lg font-bold leading-tight">{{ t('Admin') }}</h1>
        </div>
        <p class="text-[11px] text-muted mt-1 truncate">{{ displayName }}</p>
      </div>

      <nav class="flex-1 px-2 py-3 overflow-y-auto">
        <button
          v-for="item in navItems" :key="item.key"
          @click="router.push(item.path)"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
          :class="isActive(item.path)
            ? 'bg-primary text-black/80 font-semibold'
            : 'text-light hover:bg-surface-soft-hover'"
        >
          <Icon :name="item.icon" :size="16" />
          <span class="text-sm">{{ item.name }}</span>
        </button>
      </nav>

      <div class="px-3 py-3 border-t border-border">
        <BaseButton
          variant="ghost"
          icon="mdiClose"
          :icon-size="13"
          class="text-xs! py-2!"
          @click="window.close()"
        >
          {{ t('Close admin tab') }}
        </BaseButton>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>
