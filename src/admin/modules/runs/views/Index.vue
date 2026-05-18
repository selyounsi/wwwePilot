<script setup>
import { onMounted, ref } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useAdminRuns }  from '@/admin/modules/runs/composables/useAdminRuns.js'
import { useTableExport } from '@/admin/composables/useTableExport.js'

const router = useRouter()
const { t } = useI18n()
const { state, fetchAll, loadMore } = useAdminRuns()

const filterUser   = ref('')
const filterOrigin = ref('')
const filterKind   = ref('')
const filterStatus = ref('')

onMounted(() => fetchAll({ limit: 50 }))

function applyFilter() {
  const f = { limit: 50 }
  if (filterUser.value)   f.user   = filterUser.value
  if (filterOrigin.value) f.origin = filterOrigin.value
  if (filterKind.value)   f.kind   = filterKind.value
  if (filterStatus.value) f.status = filterStatus.value
  fetchAll(f)
}

const { exportCSV } = useTableExport()
function downloadCSV() {
  exportCSV({
    rows:     state.runs,
    filename: `runs-${new Date().toISOString().slice(0, 10)}.csv`,
    columns:  [
      { key: 'id',             label: 'ID' },
      { key: 'origin',         label: 'Origin' },
      { key: 'kind',           label: 'Kind' },
      { key: 'status',         label: 'Status' },
      { key: 'pages_count',    label: 'Pages' },
      { key: 'total_errors',   label: 'Errors' },
      { key: 'total_warnings', label: 'Warnings' },
      { key: 'modules_run',    label: 'Modules', get: (r) => (r.modules_run ?? []).join('|') },
      { key: 'user',           label: 'User', get: (r) => r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : (r.email ?? '') },
      { key: 'started_at',     label: 'Started' },
      { key: 'finished_at',    label: 'Finished' },
    ],
  })
}

function duration(r) {
  if (!r.finished_at) return '—'
  const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}min`
}

function openRun(r) {
  router.push({ name: 'admin-run-detail', params: { id: r.id } })
}

const columns = [
  { key: 'when',     label: 'When',     minWidth: 150 },
  { key: 'user',     label: 'User',     minWidth: 140 },
  { key: 'kind',     label: 'Kind',     minWidth: 100 },
  { key: 'status',   label: 'Status',   minWidth: 110 },
  { key: 'origin',   label: 'Origin',   minWidth: 200, truncate: true, titleFrom: r => r.origin },
  { key: 'pages',    label: 'Pages',    minWidth: 70, align: 'right' },
  { key: 'modules',  label: 'Modules',  minWidth: 80, align: 'right' },
  { key: 'errors',   label: 'Errors',   minWidth: 70, align: 'right' },
  { key: 'warnings', label: 'Warnings', minWidth: 80, align: 'right' },
  { key: 'duration', label: 'Duration', minWidth: 80, align: 'right' },
]
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Check runs') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('One row per "Prüfen"-click. Expand to see per-module breakdown.') }}
        </p>
      </div>
      <BaseButton
        variant="pill"
        icon="mdiDownload"
        :icon-size="13"
        :tooltip="t('Export as CSV')"
        @click="downloadCSV"
      >CSV</BaseButton>
    </header>

    <DataTable
      :rows="state.runs"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openRun"
      :empty-text="t('No runs yet.')"
      :has-more="state.hasMore"
      min-width="1100px"
      @load-more="loadMore"
    >
      <template #toolbar>
        <FormField v-model="filterUser"   dense mono :placeholder="t('User-ID')" class="w-full sm:w-72" />
        <FormField v-model="filterOrigin" dense :placeholder="t('Origin (e.g. https://example.com)')" class="w-full sm:w-72" />
        <SelectField v-model="filterKind" dense :options="[
          { value: '',            label: 'All kinds' },
          { value: 'single-page', label: 'Single-page' },
          { value: 'site-wide',   label: 'Site-wide' },
        ]" />
        <SelectField v-model="filterStatus" dense :options="[
          { value: '',          label: 'All statuses' },
          { value: 'running',   label: 'Running' },
          { value: 'finished',  label: 'Finished' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'aborted',   label: 'Aborted' },
        ]" />
        <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="applyFilter">{{ t('Apply') }}</BaseButton>
      </template>

      <template #cell-when="{ row }">
        <CellTimestamp :value="row.started_at" mode="both" />
      </template>

      <template #cell-user="{ row }">
        <CellUser :user="row" />
      </template>

      <template #cell-kind="{ row }">
        <CellBadge
          :variant="row.kind === 'site-wide' ? 'status' : 'neutral'"
          :value="row.kind"
          :label="row.kind === 'site-wide' ? t('Site-wide') : t('Single')"
          :class-name="row.kind === 'site-wide' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
        />
      </template>

      <template #cell-status="{ row }">
        <CellBadge variant="status" :value="row.status" />
      </template>

      <template #cell-origin="{ row }">
        <CellOrigin :value="row.origin" />
      </template>

      <template #cell-pages="{ row }">
        <CellNumber :value="row.pages_count" />
      </template>

      <template #cell-modules="{ row }">
        <CellNumber :value="(row.modules ?? []).length" />
      </template>

      <template #cell-errors="{ row }">
        <CellNumber :value="row.total_errors" error-when="> 0" />
      </template>

      <template #cell-warnings="{ row }">
        <CellNumber :value="row.total_warnings" muted-when=">= 0" />
      </template>

      <template #cell-duration="{ row }">
        <span class="text-[11px] text-muted">{{ duration(row) }}</span>
      </template>
    </DataTable>
  </div>
</template>
