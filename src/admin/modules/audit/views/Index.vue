<script setup>
import { onMounted } from 'vue'
import { useI18n }        from '@/composables/i18n/useI18n.js'
import { useAdminAudit }  from '@/admin/modules/audit/composables/useAdminAudit.js'
import { useTableExport } from '@/admin/composables/useTableExport.js'

const { t } = useI18n()
const { state, fetchAll } = useAdminAudit()

onMounted(() => fetchAll({ limit: 100 }))

const { exportCSV } = useTableExport()
function downloadCSV() {
  exportCSV({
    rows:     state.events,
    filename: `audit-${new Date().toISOString().slice(0, 10)}.csv`,
    columns:  [
      { key: 'createdAt',  label: 'Time' },
      { key: 'userId',     label: 'Actor' },
      { key: 'action',     label: 'Action' },
      { key: 'targetType', label: 'Target type' },
      { key: 'targetId',   label: 'Target id' },
      { key: 'payload',    label: 'Payload', get: (ev) => ev.payload ? JSON.stringify(ev.payload) : '' },
    ],
  })
}

function summarize(ev) {
  const parts = []
  if (ev.targetType) parts.push(`${ev.targetType}`)
  if (ev.targetId)   parts.push(`${ev.targetId}`)
  if (ev.payload && Object.keys(ev.payload).length) {
    parts.push(JSON.stringify(ev.payload))
  }
  return parts.join(' · ')
}

const columns = [
  { key: 'time',    label: 'Time',             minWidth: 150 },
  { key: 'actor',   label: 'Actor',            minWidth: 110 },
  { key: 'action',  label: 'Action',           minWidth: 200 },
  { key: 'target',  label: 'Target / Payload', minWidth: 240, truncate: true, titleFrom: summarize },
]
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Admin audit') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Append-only trail of state-changing admin actions. Read-only.') }}
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
      :rows="state.events"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :empty-text="t('No audit events yet.')"
      min-width="780px"
    >
      <template #cell-time="{ row }"><CellTimestamp :value="row.createdAt" mode="both" /></template>
      <template #cell-actor="{ row }"><CellCode :value="row.userId ?? '—'" :slice="8" /></template>
      <template #cell-action="{ row }"><code class="text-[11px] text-primary">{{ row.action }}</code></template>
      <template #cell-target="{ row }">{{ summarize(row) }}</template>
    </DataTable>
  </div>
</template>
