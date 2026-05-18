<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useAdminReports } from '@/admin/modules/reports/composables/useAdminReports.js'
import { useTableExport }  from '@/admin/composables/useTableExport.js'

const router = useRouter()
const { t } = useI18n()
const { state, fetchAll, fetchStats } = useAdminReports()

const filterStatus   = ref('open')
const filterCategory = ref('')
const filterScope    = ref('')
const statsOpen      = ref(false)

onMounted(() => fetchAll({ status: filterStatus.value, limit: 100 }))

function applyFilter() {
  const f = { limit: 100 }
  if (filterStatus.value)   f.status   = filterStatus.value
  if (filterCategory.value) f.category = filterCategory.value
  if (filterScope.value)    f.scope    = filterScope.value
  fetchAll(f)
}

async function toggleStats() {
  statsOpen.value = !statsOpen.value
  if (statsOpen.value && !state.stats) await fetchStats()
}

const { exportCSV } = useTableExport()
function downloadCSV() {
  exportCSV({
    rows:     state.reports,
    filename: `reports-${new Date().toISOString().slice(0, 10)}.csv`,
    columns:  [
      { key: 'id',          label: 'ID' },
      { key: 'title',       label: 'Title' },
      { key: 'status',      label: 'Status' },
      { key: 'severity',    label: 'Severity' },
      { key: 'category',    label: 'Category' },
      { key: 'scope',       label: 'Scope' },
      { key: 'module_id',   label: 'Module' },
      { key: 'reporter',    label: 'Reporter', get: (r) => r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : (r.email ?? '') },
      { key: 'assignee',    label: 'Assigned to', get: (r) => r.assignee_first_name && r.assignee_last_name ? `${r.assignee_first_name} ${r.assignee_last_name}` : (r.assignee_email ?? '') },
      { key: 'created_at',  label: 'Created' },
      { key: 'updated_at',  label: 'Updated' },
      { key: 'comment_count', label: 'Comments' },
    ],
  })
}

function openReport(r) {
  router.push({ name: 'admin-report-detail', params: { id: r.id } })
}

const columns = [
  { key: 'type',     label: 'Type',        minWidth: 150 },
  { key: 'title',    label: 'Title',       minWidth: 240, truncate: true, titleFrom: r => r.title },
  { key: 'user',     label: 'User',        minWidth: 140 },
  { key: 'assignee', label: 'Assigned to', minWidth: 140 },
  { key: 'when',     label: 'When',        minWidth: 150 },
  { key: 'severity', label: 'Severity',    minWidth: 90 },
  { key: 'status',   label: 'Status',      minWidth: 110 },
  { key: 'comments', label: 'Comments',    minWidth: 80, align: 'right' },
]

function categoryLabel(c) {
  switch (c) {
    case 'bug':             return t('Bug')
    case 'false_positive':  return t('False positive')
    case 'feature_request': return t('Feature request')
    default:                return t('Other')
  }
}

function categoryIcon(c) {
  switch (c) {
    case 'bug':             return 'mdiBugOutline'
    case 'false_positive':  return 'mdiFlagOutline'
    case 'feature_request': return 'mdiLightbulbOnOutline'
    default:                return 'mdiCommentQuestionOutline'
  }
}

function scopeLabel(s) {
  switch (s) {
    case 'app':         return t('App-wide')
    case 'module':      return t('Module')
    case 'module_item': return t('Finding')
    default:            return s
  }
}

function scopeIcon(s) {
  switch (s) {
    case 'app':         return 'mdiApplicationCogOutline'
    case 'module':      return 'mdiPuzzleOutline'
    case 'module_item': return 'mdiAlertCircleOutline'
    default:            return 'mdiCircleOutline'
  }
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const h = seconds / 3600
  if (h < 24) return t('{n} h', { n: h.toFixed(1) })
  return t('{n} d', { n: (h / 24).toFixed(1) })
}

function reporterDisplay(u) {
  if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`
  return u.email || u.id.slice(0, 8)
}

const inflowMax = computed(() => {
  const rows = state.stats?.inflow ?? []
  return Math.max(1, ...rows.map(r => r.n))
})
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Reports') }}</h2>
        <p class="text-xs text-muted mt-0.5">{{ t('User-submitted bug reports, feature requests and false-positive flags.') }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <BaseButton
          variant="pill"
          :icon="statsOpen ? 'mdiChevronUp' : 'mdiChartBoxOutline'"
          :icon-size="13"
          @click="toggleStats"
        >{{ statsOpen ? t('Hide stats') : t('Show stats') }}</BaseButton>
        <BaseButton
          variant="pill"
          icon="mdiDownload"
          :icon-size="13"
          :tooltip="t('Export as CSV')"
          @click="downloadCSV"
        >CSV</BaseButton>
      </div>
    </header>

    <section v-if="statsOpen && state.stats" class="bg-surface-soft border border-border rounded-xl p-4 mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Reports by category') }}</div>
        <ul class="space-y-1 text-xs">
          <li v-for="(n, k) in state.stats.byCategory" :key="k" class="flex items-center justify-between">
            <span class="text-muted">{{ categoryLabel(k) }}</span>
            <span class="font-semibold tabular-nums">{{ n }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Reports by scope') }}</div>
        <ul class="space-y-1 text-xs">
          <li v-for="(n, k) in state.stats.byScope" :key="k" class="flex items-center justify-between">
            <span class="text-muted">{{ scopeLabel(k) }}</span>
            <span class="font-semibold tabular-nums">{{ n }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Top reporters') }}</div>
        <ul class="space-y-1 text-xs">
          <li v-for="u in state.stats.topReporters" :key="u.id" class="flex items-center justify-between gap-2">
            <span class="text-muted truncate">{{ reporterDisplay(u) }}</span>
            <span class="font-semibold tabular-nums">{{ u.n }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Avg resolution time') }}</div>
        <div class="text-xl font-bold tabular-nums">{{ formatDuration(state.stats.resolution?.avgSeconds) }}</div>
        <div class="text-[10px] text-muted/60 mt-1">{{ t('Median resolution time') }}: {{ formatDuration(state.stats.resolution?.medianSeconds) }}</div>
        <div v-if="!state.stats.resolution?.sampleSize" class="text-[10px] text-muted/60 italic mt-1">{{ t('no resolved reports yet') }}</div>
      </div>

      <div class="col-span-2 lg:col-span-4">
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Inflow (last 14 days)') }}</div>
        <div v-if="state.stats.inflow?.length" class="flex items-end gap-1 h-16">
          <div
            v-for="d in state.stats.inflow" :key="d.day"
            class="flex-1 bg-primary/40 rounded-t"
            :style="{ height: `${(d.n / inflowMax) * 100}%`, minHeight: '2px' }"
            :title="`${d.day}: ${d.n}`"
          ></div>
        </div>
        <p v-else class="text-xs text-muted/60 italic">{{ t('no data') }}</p>
      </div>
    </section>

    <section class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <KpiTile
        v-for="(count, status) in state.counts" :key="status"
        :label="t(status)"
        :value="count"
        :active="filterStatus === status"
        clickable
        @click="filterStatus = status; applyFilter()"
      />
    </section>

    <DataTable
      :rows="state.reports"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openReport"
      :empty-text="t('No reports yet.')"
      min-width="900px"
    >
      <template #toolbar>
        <SelectField v-model="filterStatus" dense :options="[
          { value: '',              label: 'All statuses' },
          { value: 'open',          label: 'Open' },
          { value: 'investigating', label: 'Investigating' },
          { value: 'resolved',      label: 'Resolved' },
          { value: 'wont_fix',      label: `Won't fix` },
        ]" />
        <SelectField v-model="filterCategory" dense :options="[
          { value: '',                label: 'All categories' },
          { value: 'bug',             label: 'Bug' },
          { value: 'false_positive',  label: 'False positive' },
          { value: 'feature_request', label: 'Feature request' },
          { value: 'other',           label: 'Other' },
        ]" />
        <SelectField v-model="filterScope" dense :options="[
          { value: '',            label: 'All scopes' },
          { value: 'app',         label: 'App-wide' },
          { value: 'module',      label: 'Module-scoped' },
          { value: 'module_item', label: 'Item-scoped' },
        ]" />
        <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="applyFilter">{{ t('Apply') }}</BaseButton>
      </template>

      <template #cell-type="{ row }">
        <div class="inline-flex flex-col gap-1">
          <CellBadge variant="scope" :value="row.scope" :icon="scopeIcon(row.scope)" :label="scopeLabel(row.scope)" />
          <CellBadge variant="category" :value="row.category" :icon="categoryIcon(row.category)" :label="categoryLabel(row.category)" />
        </div>
      </template>

      <template #cell-title="{ row }">
        <span class="text-[11px]">{{ row.title }}</span>
      </template>

      <template #cell-user="{ row }">
        <CellUser :user="row" />
      </template>

      <template #cell-assignee="{ row }">
        <CellUser :user="row" prefix="assignee" :empty-label="t('Unassigned')" />
      </template>

      <template #cell-when="{ row }">
        <CellTimestamp :value="row.created_at" mode="both" />
      </template>

      <template #cell-severity="{ row }">
        <CellBadge variant="severity" :value="row.severity" />
      </template>

      <template #cell-status="{ row }">
        <CellBadge variant="status" :value="row.status" />
      </template>

      <template #cell-comments="{ row }">
        <CellNumber :value="row.comment_count" />
      </template>
    </DataTable>
  </div>
</template>
