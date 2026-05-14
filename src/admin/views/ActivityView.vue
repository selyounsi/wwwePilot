<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n }          from '@/composables/i18n/useI18n.js'
import { useAdminActivity } from '@/admin/composables/useAdminActivity.js'

const { t } = useI18n()
const { state, fetchEvents, loadMore, fetchCounts } = useAdminActivity()

const filterUser = ref('')
const filterType = ref('')
const filterDays = ref(7)

onMounted(async () => {
  await Promise.all([
    fetchEvents({ limit: 50 }),
    fetchCounts(30),
  ])
})

function applyFilter() {
  const filters = { limit: 50 }
  if (filterUser.value) filters.user = filterUser.value
  if (filterType.value) filters.type = filterType.value
  if (filterDays.value) {
    filters.since = new Date(Date.now() - filterDays.value * 86_400_000).toISOString()
  }
  fetchEvents(filters)
}

const maxCount = computed(() =>
  state.counts.length ? Math.max(...state.counts.map(c => c.count)) : 0
)

function formatTime(ts) {
  return new Date(ts).toLocaleString()
}

function summarize(ev) {
  const p = ev.payload ?? {}
  switch (ev.type) {
    case 'web_check.module':
      return `${p.moduleId} → ${p.errorCount ?? 0} errors, ${p.warningCount ?? 0} warnings (${p.durationMs ?? 0}ms)`
    case 'chatbot.message':
      return `${p.provider ?? '?'} status=${p.status ?? '?'}`
    case 'auth.login':
      return p.stub ? t('stub login') : t('OIDC login')
    case 'auth.logout':
      return t('logout')
    default:
      return Object.entries(p).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
  }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6">
      <h2 class="text-xl font-bold">{{ t('Activity') }}</h2>
      <p class="text-xs text-muted mt-0.5">
        {{ t('Live feed + aggregates. Web-checker runs, logins, chatbot calls.') }}
      </p>
    </header>

    <section class="bg-surface-soft border border-border rounded-xl p-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-sm">{{ t('Event counts ({n} days)', { n: state.days }) }}</h3>
        <select
          @change="fetchCounts(Number($event.target.value))"
          class="bg-surface border border-border rounded px-2 py-1 text-xs"
        >
          <option :value="7">{{ t('Last 7 days') }}</option>
          <option :value="30" selected>{{ t('Last 30 days') }}</option>
          <option :value="90">{{ t('Last 90 days') }}</option>
        </select>
      </div>
      <div v-if="!state.counts.length" class="text-sm text-muted">{{ t('No events in range.') }}</div>
      <div v-else class="space-y-1.5">
        <div
          v-for="c in state.counts" :key="c.type"
          class="flex items-center gap-2"
        >
          <code class="text-[11px] text-light w-44 truncate">{{ c.type }}</code>
          <div class="flex-1 bg-surface rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-primary transition-all"
              :style="{ width: maxCount > 0 ? `${(c.count / maxCount) * 100}%` : '0%' }"
            />
          </div>
          <span class="text-xs tabular-nums w-12 text-right">{{ c.count }}</span>
        </div>
      </div>
    </section>

    <section class="bg-surface-soft border border-border rounded-xl">
      <div class="px-4 py-3 border-b border-border/60 flex flex-wrap gap-2 items-center">
        <input
          v-model="filterUser"
          :placeholder="t('User-ID')"
          class="bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono w-72 focus:outline-none focus:border-primary/60"
        />
        <input
          v-model="filterType"
          :placeholder="t('Type (e.g. web_check.module)')"
          class="bg-surface border border-border rounded px-2 py-1.5 text-xs w-56 focus:outline-none focus:border-primary/60"
        />
        <select v-model.number="filterDays" class="bg-surface border border-border rounded px-2 py-1.5 text-xs">
          <option :value="1">{{ t('Last 24h') }}</option>
          <option :value="7" selected>{{ t('Last 7 days') }}</option>
          <option :value="30">{{ t('Last 30 days') }}</option>
          <option :value="0">{{ t('All time') }}</option>
        </select>
        <BaseButton class="text-xs! py-1.5!" @click="applyFilter">{{ t('Apply') }}</BaseButton>
      </div>

      <div v-if="state.loading" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <div v-else>
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('Time') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Type') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('User') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Target') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Details') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ev in state.events" :key="ev.id"
              class="border-t border-border/40 hover:bg-surface-soft-hover"
            >
              <td class="px-4 py-2 text-[11px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(ev.createdAt) }}</td>
              <td class="px-4 py-2"><code class="text-[11px]">{{ ev.type }}</code></td>
              <td class="px-4 py-2 text-[11px] text-muted font-mono">{{ (ev.userId ?? '—').slice(0, 8) }}</td>
              <td class="px-4 py-2 text-[11px] max-w-xs truncate" :title="ev.target ?? ''">{{ ev.target ?? '—' }}</td>
              <td class="px-4 py-2 text-[11px] text-muted">{{ summarize(ev) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!state.events.length" class="text-center text-muted py-8 text-sm">{{ t('No events match the filter.') }}</p>
        <div v-else-if="state.hasMore" class="px-4 py-3 text-center border-t border-border/40">
          <BaseButton variant="ghost" class="text-xs! py-1.5!" @click="loadMore">{{ t('Load more') }}</BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
