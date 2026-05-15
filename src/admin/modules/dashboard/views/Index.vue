<script setup>
import { onMounted, computed } from 'vue'
import { useRouter }          from 'vue-router'
import { useI18n }            from '@/composables/i18n/useI18n.js'
import { useToast }           from '@/composables/useToast.js'
import { useAdminDashboard } from '@/admin/modules/dashboard/composables/useAdminDashboard.js'
import { useAdminReports }   from '@/admin/modules/reports/composables/useAdminReports.js'
import { usePermissions }     from '@/composables/usePermissions.js'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { state, fetchAll, refresh, setTrendDays } = useAdminDashboard()
const { state: reportsState, fetchCounts: fetchReportCounts } = useAdminReports()
const { has } = usePermissions()

const canReadReports = computed(() => has('admin.reports.read'))
const openReports = computed(() => (reportsState.counts?.open ?? 0) + (reportsState.counts?.investigating ?? 0))

onMounted(() => {
  fetchAll()
  if (canReadReports.value) fetchReportCounts()
})

async function onRefresh() {
  await refresh()
  toast.success(t('Dashboard refreshed'))
}

const trendMax = computed(() => {
  const max = Math.max(0, ...state.trend.map(p => Number(p.active_users) || 0))
  return max || 1
})

const eventTrendMax = computed(() => {
  const max = Math.max(0, ...state.trend.map(p => Number(p.event_count) || 0))
  return max || 1
})

const moduleMax = computed(() => {
  const max = Math.max(0, ...state.modules.map(m => Number(m.run_count) || 0))
  return max || 1
})

function formatNumber(n) {
  return new Intl.NumberFormat('de-DE').format(n ?? 0)
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)    return t('just now')
  if (min < 60)   return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)     return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}

const oldestRefresh = computed(() => {
  const r = state.kpi?.lastRefresh ?? {}
  const ts = Object.values(r).filter(Boolean)
  if (!ts.length) return null
  return Math.min(...ts)
})
</script>

<template>
  <div class="p-6">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold">{{ t('Dashboard') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Aggregate stats — refreshed every 5–60 min from materialized views.') }}
          <span v-if="oldestRefresh" class="text-muted/60 ml-2">
            ({{ t('oldest data') }}: {{ relative(oldestRefresh) }})
          </span>
        </p>
      </div>
      <BaseButton class="text-xs! py-1.5!" @click="onRefresh">
        <Icon name="mdiRefresh" :size="13" />
        {{ t('Refresh now') }}
      </BaseButton>
    </header>

    <div v-if="state.loading && !state.kpi" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4">
      <p class="text-sm text-error">{{ state.error }}</p>
    </div>

    <div v-else-if="state.kpi" class="space-y-6">
      <!-- KPI tiles -->
      <section class="grid grid-cols-4 gap-3">
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Active today') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatNumber(state.kpi.today.activeUsers) }}</div>
          <div class="text-[11px] text-muted mt-1">
            {{ t('Avg 7 days') }}: <span class="tabular-nums">{{ formatNumber(state.kpi.avgDau7d) }}</span>
          </div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('MAU (30d)') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatNumber(state.kpi.mau) }}</div>
          <div class="text-[11px] text-muted mt-1">
            {{ t('of {n} total', { n: formatNumber(state.kpi.totalUsers) }) }}
          </div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Sites tested (30d)') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatNumber(state.kpi.sites30d) }}</div>
          <div class="text-[11px] text-muted mt-1">{{ t('unique origins') }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Module runs (30d)') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatNumber(state.kpi.runs30d) }}</div>
          <div class="text-[11px] text-muted mt-1">{{ t('events recorded') }}</div>
        </div>
      </section>

      <!-- Tickets / Reports — clickable to jump straight to the filtered list -->
      <section v-if="canReadReports" class="grid grid-cols-4 gap-3">
        <button
          @click="router.push({ name: 'admin-reports' })"
          class="bg-surface-soft border rounded-xl p-4 text-left transition-colors hover:bg-surface-soft-hover"
          :class="openReports > 0 ? 'border-error/40 hover:border-error/60' : 'border-border hover:border-primary/40'"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Open reports') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1" :class="openReports > 0 && 'text-error'">
            {{ formatNumber(openReports) }}
          </div>
          <div class="text-[11px] text-muted mt-1">
            {{ formatNumber(reportsState.counts?.open ?? 0) }} {{ t('open') }} ·
            {{ formatNumber(reportsState.counts?.investigating ?? 0) }} {{ t('investigating') }}
          </div>
        </button>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Resolved') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1 text-success">{{ formatNumber(reportsState.counts?.resolved ?? 0) }}</div>
          <div class="text-[11px] text-muted mt-1">{{ t('all time') }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t("Won't fix") }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1 text-muted">{{ formatNumber(reportsState.counts?.wont_fix ?? 0) }}</div>
          <div class="text-[11px] text-muted mt-1">{{ t('all time') }}</div>
        </div>
        <button
          @click="router.push({ name: 'admin-reports' })"
          class="bg-primary/10 border border-primary/40 rounded-xl p-4 text-left transition-colors hover:bg-primary/15 flex flex-col"
        >
          <div class="text-[10px] uppercase tracking-wide text-primary/70">{{ t('Open ticket queue') }}</div>
          <div class="flex-1 flex items-center mt-1">
            <Icon name="mdiArrowRight" :size="22" class="text-primary" />
            <span class="text-sm font-semibold text-primary ml-2">{{ t('Go to reports') }}</span>
          </div>
        </button>
      </section>

      <!-- Trend chart -->
      <section class="bg-surface-soft border border-border rounded-xl p-4">
        <header class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-semibold text-sm">{{ t('Active users trend') }}</h3>
            <p class="text-[11px] text-muted">{{ t('Daily distinct users, last {n} days', { n: state.trendDays }) }}</p>
          </div>
          <select
            :value="state.trendDays"
            @change="setTrendDays(Number($event.target.value))"
            class="bg-surface border border-border rounded px-2 py-1 text-xs"
          >
            <option :value="7">{{ t('Last 7 days') }}</option>
            <option :value="30">{{ t('Last 30 days') }}</option>
            <option :value="90">{{ t('Last 90 days') }}</option>
          </select>
        </header>
        <div v-if="!state.trend.length" class="text-sm text-muted py-8 text-center">
          {{ t('No data in range.') }}
        </div>
        <div v-else class="flex items-end gap-1 h-32">
          <div
            v-for="(p, i) in state.trend" :key="i"
            class="flex-1 flex flex-col items-center gap-1 group relative"
          >
            <div
              class="w-full bg-primary/30 hover:bg-primary/60 rounded-sm transition-colors relative"
              :style="{ height: `${(Number(p.active_users) || 0) / trendMax * 100}%`, minHeight: '2px' }"
            >
              <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-surface border border-border rounded px-2 py-0.5 text-[10px] text-light opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                {{ formatDate(p.day) }}: {{ formatNumber(p.active_users) }}
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-between text-[10px] text-muted/60 mt-1">
          <span>{{ formatDate(state.trend[0]?.day) }}</span>
          <span>{{ formatDate(state.trend[state.trend.length - 1]?.day) }}</span>
        </div>
      </section>

      <!-- Module usage + Top sites side by side -->
      <div class="grid grid-cols-2 gap-3">
        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <h3 class="font-semibold text-sm mb-3">{{ t('Module usage (30d)') }}</h3>
          <div v-if="!state.modules.length" class="text-sm text-muted text-center py-6">
            {{ t('No runs yet.') }}
          </div>
          <div v-else class="space-y-1.5">
            <div
              v-for="m in state.modules" :key="m.module_id"
              class="flex items-center gap-2"
            >
              <code class="text-[11px] text-light w-28 truncate">{{ m.module_id }}</code>
              <div class="flex-1 bg-surface rounded-full h-2 overflow-hidden">
                <div
                  class="h-full bg-primary transition-all"
                  :style="{ width: `${(Number(m.run_count) || 0) / moduleMax * 100}%` }"
                />
              </div>
              <span class="text-xs tabular-nums w-12 text-right">{{ formatNumber(m.run_count) }}</span>
              <span class="text-[10px] text-muted/60 w-16 text-right tabular-nums">
                {{ m.avg_duration_ms }}ms
              </span>
            </div>
          </div>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <h3 class="font-semibold text-sm mb-3">{{ t('Top sites by activity (30d)') }}</h3>
          <div v-if="!state.sites.length" class="text-sm text-muted text-center py-6">
            {{ t('No sites tracked yet.') }}
          </div>
          <table v-else class="w-full text-sm">
            <thead class="text-[10px] uppercase tracking-wide text-muted/60">
              <tr>
                <th class="text-left font-medium pb-1">{{ t('Origin') }}</th>
                <th class="text-right font-medium pb-1">{{ t('Runs') }}</th>
                <th class="text-right font-medium pb-1">{{ t('Errors') }}</th>
                <th class="text-right font-medium pb-1">{{ t('Warnings') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in state.sites" :key="s.origin" class="border-t border-border/30">
                <td class="py-1.5 text-[11px] truncate max-w-[180px]" :title="s.origin">
                  {{ shortHost(s.origin) }}
                </td>
                <td class="py-1.5 text-[11px] text-right tabular-nums">{{ formatNumber(s.run_count) }}</td>
                <td class="py-1.5 text-[11px] text-right tabular-nums" :class="Number(s.error_total) > 0 && 'text-error'">
                  {{ formatNumber(s.error_total) }}
                </td>
                <td class="py-1.5 text-[11px] text-right tabular-nums text-muted">{{ formatNumber(s.warning_total) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <!-- Top users -->
      <section v-if="state.topUsers.length" class="bg-surface-soft border border-border rounded-xl p-4">
        <h3 class="font-semibold text-sm mb-3">{{ t('Most active users (30d)') }}</h3>
        <table class="w-full text-sm">
          <thead class="text-[10px] uppercase tracking-wide text-muted/60">
            <tr>
              <th class="text-left font-medium pb-1">{{ t('User') }}</th>
              <th class="text-right font-medium pb-1">{{ t('Events') }}</th>
              <th class="text-right font-medium pb-1">{{ t('Checks') }}</th>
              <th class="text-right font-medium pb-1">{{ t('Last seen') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in state.topUsers" :key="u.user_id" class="border-t border-border/30">
              <td class="py-1.5 text-[11px]">
                <span class="font-medium">
                  {{ u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : (u.email || u.user_id?.slice(0, 8)) }}
                </span>
                <span class="text-muted/60 ml-1">{{ u.email }}</span>
              </td>
              <td class="py-1.5 text-[11px] text-right tabular-nums">{{ formatNumber(u.event_count) }}</td>
              <td class="py-1.5 text-[11px] text-right tabular-nums">{{ formatNumber(u.check_count) }}</td>
              <td class="py-1.5 text-[11px] text-right text-muted">{{ relative(u.last_seen_at) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
