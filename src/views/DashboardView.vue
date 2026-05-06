<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useModuleLoader }  from '@/composables/loaders/useModuleLoader.js'
import { useCheckStore }    from '@/services/web-checker/composables/useCheckStore.js'
import { useRunHistory }    from '@/services/web-checker/composables/useRunHistory.js'
import { useI18n }          from '@/composables/i18n/useI18n.js'
import { useAuth }          from '@/composables/auth/useAuth.js'
import { useFavorites }     from '@/composables/useFavorites.js'
import { APP_NAME }         from '@/config/app.js'

const router = useRouter()
const { services } = useServiceLoader()
const { state } = useCheckStore()
const { t } = useI18n()
const { state: authState } = useAuth()
const { state: favState, toggle: toggleFavorite } = useFavorites()
const runHistory = useRunHistory()

const greeting = computed(() => {
  const u = authState.user
  const first = u?.firstName || u?.username || u?.name?.split(' ')[0] || ''
  return first ? t('Hi, {name}!', { name: first }) : t('Choose a service')
})

const checkerRunning = computed(() =>
  Object.values(state.results).some(r => r.status === 'running')
)

const checkerErrors = computed(() => {
  const results = Object.values(state.results)
  if (!results.length) return null
  return results.reduce((sum, r) => sum + (r.errorCount ?? 0), 0)
})

const checkerWarnings = computed(() => {
  const results = Object.values(state.results)
  if (!results.length) return null
  return results.reduce((sum, r) => sum + (r.warningCount ?? 0), 0)
})

const moduleByKey = computed(() => {
  const map = new Map()
  for (const s of services) {
    const { modules } = useModuleLoader(s.id)
    for (const m of modules) {
      map.set(`${s.id}:${m.id}`, { ...m, serviceId: s.id, serviceName: s.name })
    }
  }
  return map
})

const favoriteModules = computed(() =>
  favState.ids
    .map(key => moduleByKey.value.get(key))
    .filter(Boolean),
)

const recentSites = computed(() => {
  const byOrigin = new Map()
  for (const k in runHistory.state.byKey) {
    const [origin] = k.split('::')
    const list = runHistory.state.byKey[k]
    const last = list[list.length - 1]
    if (!origin || !last) continue
    const agg = byOrigin.get(origin) ?? { origin, lastSeen: 0, errors: 0, warnings: 0 }
    if (last.timestamp > agg.lastSeen) agg.lastSeen = last.timestamp
    agg.errors   += last.errorCount   || 0
    agg.warnings += last.warningCount || 0
    byOrigin.set(origin, agg)
  }
  return [...byOrigin.values()].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 5)
})

function relativeTime(ms) {
  const diff = Date.now() - ms
  const s = Math.floor(diff / 1000)
  if (s < 60)    return t('just now')
  const min = Math.floor(s / 60)
  if (min < 60)  return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)    return t('{n} h ago',   { n: h })
  const d = Math.floor(h / 24)
  if (d < 7)     return t('{n} d ago',   { n: d })
  return new Date(ms).toLocaleDateString()
}

function shortOrigin(origin) {
  try { return new URL(origin).host } catch { return origin }
}

function openSiteDetail(origin) {
  router.push({ path: '/service/web-checker/site-detail', query: { origin } })
}

function openSite(origin, ev) {
  ev?.stopPropagation()
  chrome.tabs.create({ url: origin, active: true })
}

function removeSite(origin, ev) {
  ev?.stopPropagation()
  runHistory.clear(origin)
}
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader :title="APP_NAME" :subtitle="greeting" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-5">

      <section v-if="favoriteModules.length" class="flex flex-col gap-2">
        <SectionLabel>{{ t('My favorites') }}</SectionLabel>
        <CardItem
          v-for="mod in favoriteModules" :key="mod.serviceId + ':' + mod.id"
          :icon="mod.icon" :title="t(mod.name)" :description="t(mod.description)"
          @click="router.push(`/service/${mod.serviceId}/module/${mod.id}`)"
        >
          <button
            @click.stop="toggleFavorite(mod.serviceId, mod.id)"
            class="p-1 rounded-md hover:bg-surface transition-colors"
            :title="t('Remove from favorites')"
          >
            <Icon name="mdiStar" :size="14" class="text-primary" />
          </button>
        </CardItem>
      </section>

      <section v-if="recentSites.length" class="flex flex-col gap-2">
        <SectionLabel>{{ t('Recently checked') }}</SectionLabel>
        <button
          v-for="site in recentSites" :key="site.origin"
          @click="openSiteDetail(site.origin)"
          class="flex items-center justify-between w-full bg-surface-soft border border-border rounded-xl px-4 py-3 transition-all hover:bg-surface-soft-hover hover:border-primary/40 cursor-pointer group text-left"
        >
          <div class="flex items-center gap-3 min-w-0">
            <Icon name="mdiHistory" :size="18" class="text-muted group-hover:text-primary shrink-0 transition-colors" />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {{ shortOrigin(site.origin) }}
              </p>
              <p class="text-xs text-muted">{{ relativeTime(site.lastSeen) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 ml-2">
            <StatusPill :count="site.errors || null" :warning-count="site.warnings || null" />
            <button
              @click="openSite(site.origin, $event)"
              class="p-1 rounded-md text-muted/40 hover:text-primary hover:bg-surface transition-colors"
              :title="t('Open in new tab')"
            >
              <Icon name="mdiOpenInNew" :size="14" />
            </button>
            <button
              @click="removeSite(site.origin, $event)"
              class="p-1 rounded-md text-muted/40 hover:text-error hover:bg-error/10 transition-colors"
              :title="t('Remove from history')"
            >
              <Icon name="mdiClose" :size="14" />
            </button>
          </div>
        </button>
      </section>

      <section class="flex flex-col gap-2">
        <SectionLabel>{{ t('Services') }}</SectionLabel>
        <CardItem
          v-for="s in services" :key="s.id"
          :icon="s.icon" :title="t(s.name)" :description="t(s.description)"
          @click="router.push(`/service/${s.id}`)"
        >
          <template v-if="s.id === 'web-checker'">
            <LoadingSpinner v-if="checkerRunning" size="sm" />
            <StatusPill v-else :count="checkerErrors" :warning-count="checkerWarnings" />
          </template>
        </CardItem>
        <EmptyState v-if="services.length === 0">
          {{ t('No active services found.') }}
        </EmptyState>
      </section>

    </div>
  </div>
</template>
