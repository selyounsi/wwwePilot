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

import { relativeTime } from '@/admin/composables/timelineFormat.js'
function relative(ts) { return relativeTime(ts, t) }

const sitesColumns = [
  { key: 'origin',   label: 'Origin',   minWidth: 180, truncate: true, titleFrom: s => s.origin },
  { key: 'runs',     label: 'Runs',     minWidth: 60,  align: 'right' },
  { key: 'errors',   label: 'Errors',   minWidth: 70,  align: 'right' },
  { key: 'warnings', label: 'Warnings', minWidth: 80,  align: 'right' },
]
const topUsersColumns = [
  { key: 'user',   label: 'User',      minWidth: 200 },
  { key: 'events', label: 'Events',    minWidth: 70,  align: 'right' },
  { key: 'checks', label: 'Checks',    minWidth: 70,  align: 'right' },
  { key: 'seen',   label: 'Last seen', minWidth: 100, align: 'right' },
]

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
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile :label="t('Active today')" :value="formatNumber(state.kpi.today.activeUsers)"
          :sublabel="`${t('Avg 7 days')}: ${formatNumber(state.kpi.avgDau7d)}`" />
        <KpiTile :label="t('MAU (30d)')" :value="formatNumber(state.kpi.mau)"
          :sublabel="t('of {n} total', { n: formatNumber(state.kpi.totalUsers) })" />
        <KpiTile :label="t('Sites tested (30d)')" :value="formatNumber(state.kpi.sites30d)" :sublabel="t('unique origins')" />
        <KpiTile :label="t('Module runs (30d)')" :value="formatNumber(state.kpi.runs30d)" :sublabel="t('events recorded')" />
      </section>

      <section v-if="canReadReports" class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          :label="t('Open reports')"
          :value="formatNumber(openReports)"
          :tone="openReports > 0 ? 'error' : 'default'"
          :sublabel="`${formatNumber(reportsState.counts?.open ?? 0)} ${t('open')} · ${formatNumber(reportsState.counts?.investigating ?? 0)} ${t('investigating')}`"
          clickable
          @click="router.push({ name: 'admin-reports' })"
        />
        <KpiTile :label="t('Resolved')" :value="formatNumber(reportsState.counts?.resolved ?? 0)" tone="success" :sublabel="t('all time')" />
        <KpiTile :label="t(`Won't fix`)" :value="formatNumber(reportsState.counts?.wont_fix ?? 0)" tone="muted" :sublabel="t('all time')" />
        <KpiTile
          :label="t('Open ticket queue')"
          tone="primary"
          clickable
          @click="router.push({ name: 'admin-reports' })"
        >
          <template #value>
            <div class="flex items-center text-sm font-semibold text-primary mt-1">
              <Icon name="mdiArrowRight" :size="22" class="text-primary mr-2" />
              {{ t('Go to reports') }}
            </div>
          </template>
        </KpiTile>
      </section>

      <!-- Trend chart -->
      <section class="bg-surface-soft border border-border rounded-xl p-4">
        <header class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-semibold text-sm">{{ t('Active users trend') }}</h3>
            <p class="text-[11px] text-muted">{{ t('Daily distinct users, last {n} days', { n: state.trendDays }) }}</p>
          </div>
          <SelectField
            :model-value="state.trendDays"
            dense
            @update:modelValue="setTrendDays(Number($event))"
          >
            <option :value="7">{{ t('Last 7 days') }}</option>
            <option :value="30">{{ t('Last 30 days') }}</option>
            <option :value="90">{{ t('Last 90 days') }}</option>
          </SelectField>
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

        <section>
          <h3 class="font-semibold text-sm mb-3">{{ t('Top sites by activity (30d)') }}</h3>
          <DataTable
            :rows="state.sites"
            :columns="sitesColumns"
            :empty-text="t('No sites tracked yet.')"
            :row-key="s => s.origin"
            dense
            min-width="480px"
          >
            <template #cell-origin="{ row }"><CellOrigin :value="row.origin" /></template>
            <template #cell-runs="{ row }"><CellNumber :value="row.run_count" /></template>
            <template #cell-errors="{ row }"><CellNumber :value="row.error_total" error-when="> 0" /></template>
            <template #cell-warnings="{ row }"><CellNumber :value="row.warning_total" muted-when=">= 0" /></template>
          </DataTable>
        </section>
      </div>

      <!-- Activity stream -->
      <AdminActivityStream :limit="25" />

      <section v-if="state.topUsers.length">
        <h3 class="font-semibold text-sm mb-3">{{ t('Most active users (30d)') }}</h3>
        <DataTable
          :rows="state.topUsers"
          :columns="topUsersColumns"
          :row-key="u => u.user_id"
          dense
          min-width="600px"
        >
          <template #cell-user="{ row }"><CellUser :user="row" show-email /></template>
          <template #cell-events="{ row }"><CellNumber :value="row.event_count" /></template>
          <template #cell-checks="{ row }"><CellNumber :value="row.check_count" /></template>
          <template #cell-seen="{ row }"><CellTimestamp :value="row.last_seen_at" mode="relative" /></template>
        </DataTable>
      </section>
    </div>
  </div>
</template>
