<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useAuth }         from '@/composables/auth/useAuth.js'
import { usePermissions }  from '@/composables/usePermissions.js'
import { useAdminReports } from '@/admin/modules/reports/composables/useAdminReports.js'
import { useAdminRoles }   from '@/admin/modules/roles/composables/useAdminRoles.js'
import { adminNav, adminNavGroups } from '@/admin/routes.js'

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
// Safety net: even with `fixed inset-0` on the root, if any descendant view
// sets its own height incorrectly the document body can still scroll behind
// the admin shell. Locking body overflow while admin is mounted guarantees
// only the inner main column ever scrolls. Restored on unmount so this
// doesn't leak into the side-panel context.
let prevBodyOverflow = null
let prevHtmlOverflow = null
onMounted(() => {
  prevBodyOverflow = document.body.style.overflow
  prevHtmlOverflow = document.documentElement.style.overflow
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'

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
  document.body.style.overflow = prevBodyOverflow ?? ''
  document.documentElement.style.overflow = prevHtmlOverflow ?? ''
})

function decorate(n) {
  const badge = n.badge ? (badgeResolvers[n.badge]?.() ?? null) : null
  return {
    key:   n.key,
    path:  n.path,
    icon:  n.icon,
    name:  t(n.label),
    badge: badge > 0 ? badge : null,
  }
}

/**
 * Sidebar render tree. Top-level items and groups share a single
 * `order`-sorted list so a group can sit between two ungrouped items
 * (e.g. "Roles" — Web-checker — "Feature flags"). Empty groups (no
 * permitted children) are dropped.
 */
const navTree = computed(() => {
  const filtered = adminNav.filter(n => !n.permission || has(n.permission))
  const byGroup  = new Map()
  const tree     = []

  for (const item of filtered) {
    if (item.group) {
      if (!byGroup.has(item.group)) byGroup.set(item.group, [])
      byGroup.get(item.group).push(item)
    } else {
      tree.push({ type: 'item', order: item.order, ...decorate(item) })
    }
  }

  for (const [key, items] of byGroup.entries()) {
    if (!items.length) continue
    const meta = adminNavGroups[key] ?? { order: 500, label: key, icon: 'mdiFolderOutline' }
    tree.push({
      type:  'group',
      key,
      label: t(meta.label),
      icon:  meta.icon,
      order: meta.order,
      items: items
        .sort((a, b) => a.order - b.order)
        .map(decorate),
    })
  }

  return tree.sort((a, b) => a.order - b.order)
})

const isActive = (path) => route.path === path || route.path.startsWith(path + '/')

// Group expand state — persisted per-browser. Default: every group is
// collapsed; the user opts in by clicking the header. Groups whose child
// matches the current route are force-expanded so a deep link never lands
// on a hidden item.
const EXPAND_KEY = 'admin-nav-expanded-groups'
const expanded = ref(loadExpanded())
function loadExpanded() {
  try { return new Set(JSON.parse(localStorage.getItem(EXPAND_KEY) ?? '[]')) }
  catch { return new Set() }
}
function persistExpanded() {
  try { localStorage.setItem(EXPAND_KEY, JSON.stringify([...expanded.value])) } catch {}
}
function toggleGroup(key) {
  if (expanded.value.has(key)) expanded.value.delete(key)
  else                         expanded.value.add(key)
  expanded.value = new Set(expanded.value)
  persistExpanded()
}
function isGroupOpen(group) {
  if (isGroupActive(group)) return true
  return expanded.value.has(group.key)
}
function isGroupActive(group) {
  return group.items.some(i => isActive(i.path))
}

const version = chrome.runtime?.getManifest?.()?.version ?? ''

// `window` isn't auto-bound in Vue's template scope — calling `window.close()`
// directly from `@click` throws "Cannot read properties of undefined". Wrap
// it in a script-setup function so the template just calls the function.
function closeTab() {
  window.close()
}

const quickSwitcherRef = ref(null)
function openQuickSwitcher() {
  quickSwitcherRef.value?.open()
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
  <!-- fixed inset-0 instead of h-screen so the admin layout is anchored
       to the viewport and ignores whatever min-height ancestors might
       set. Sidebar stays put, only the main column scrolls. -->
  <div class="fixed inset-0 bg-background flex overflow-hidden">
    <aside class="w-64 bg-surface-soft border-r border-border flex flex-col shrink-0 h-full">
      <div class="px-5 py-4 border-b border-border shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="mdiShieldCrownOutline" :size="20" class="text-primary shrink-0" />
          <h1 class="text-lg font-bold leading-tight truncate flex-1">{{ t('Backend') }}</h1>
          <AdminNotificationBell />
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

      <button
        class="mx-2 mt-3 mb-1 shrink-0 flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-left text-xs text-muted hover:bg-surface-soft-hover transition-colors"
        @click="openQuickSwitcher"
      >
        <Icon name="mdiMagnify" :size="14" />
        <span class="flex-1">{{ t('Search…') }}</span>
        <kbd class="text-[9px] font-mono px-1 py-0.5 bg-background rounded border border-border">⌘K</kbd>
      </button>

      <nav class="flex-1 px-2 py-3 overflow-y-auto min-h-0">
        <template v-for="node in navTree">
          <!-- Top-level item -->
          <button
            v-if="node.type === 'item'"
            :key="`item-${node.key}`"
            @click="router.push(node.path)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
            :class="isActive(node.path)
              ? 'bg-primary text-black/80 font-semibold'
              : 'text-light hover:bg-surface-soft-hover'"
          >
            <Icon :name="node.icon" :size="16" />
            <span class="text-sm flex-1">{{ node.name }}</span>
            <span
              v-if="node.badge"
              class="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full min-w-5 text-center"
              :class="isActive(node.path)
                ? 'bg-black/20 text-black/80'
                : 'bg-error/20 text-error'"
            >{{ node.badge }}</span>
          </button>

          <!-- Group with sub-items -->
          <div v-else :key="`group-${node.key}`">
            <button
              @click="toggleGroup(node.key)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
              :class="isGroupActive(node)
                ? 'text-primary font-semibold'
                : 'text-light hover:bg-surface-soft-hover'"
            >
              <Icon :name="node.icon" :size="16" />
              <span class="text-sm flex-1">{{ node.label }}</span>
              <Icon
                :name="isGroupOpen(node) ? 'mdiChevronDown' : 'mdiChevronRight'"
                :size="14"
                class="opacity-60"
              />
            </button>

            <div v-show="isGroupOpen(node)" class="pl-3 mt-0.5 space-y-0.5">
              <button
                v-for="sub in node.items" :key="sub.key"
                @click="router.push(sub.path)"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                :class="isActive(sub.path)
                  ? 'bg-primary text-black/80 font-semibold'
                  : 'text-light hover:bg-surface-soft-hover'"
              >
                <Icon :name="sub.icon" :size="14" />
                <span class="text-sm flex-1">{{ sub.name }}</span>
                <span
                  v-if="sub.badge"
                  class="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full min-w-5 text-center"
                  :class="isActive(sub.path)
                    ? 'bg-black/20 text-black/80'
                    : 'bg-error/20 text-error'"
                >{{ sub.badge }}</span>
              </button>
            </div>
          </div>
        </template>
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

    <main class="flex-1 overflow-y-auto overflow-x-hidden h-full min-w-0">
      <RouterView />
    </main>

    <AdminQuickSwitcher ref="quickSwitcherRef" />
  </div>
</template>
