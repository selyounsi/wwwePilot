<script setup>
import { onMounted, ref } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useAdminSites } from '@/admin/modules/sites/composables/useAdminSites.js'

const router = useRouter()
const { t } = useI18n()
const { state, fetchAll } = useAdminSites()

const days = ref(30)

onMounted(() => fetchAll(days.value))

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}

function openDetail(s) {
  router.push({ name: 'admin-site-detail', params: { origin: encodeURIComponent(s.origin) } })
}

const columns = [
  { key: 'origin',   label: 'Origin',   minWidth: 240 },
  { key: 'runs',     label: 'Runs',     minWidth: 70,  align: 'right' },
  { key: 'users',    label: 'Users',    minWidth: 70,  align: 'right' },
  { key: 'errors',   label: 'Errors',   minWidth: 80,  align: 'right' },
  { key: 'warnings', label: 'Warnings', minWidth: 80,  align: 'right' },
  { key: 'notes',    label: 'Notes',    minWidth: 70,  align: 'right' },
  { key: 'lastRun',  label: 'Last run', minWidth: 110, align: 'right' },
]
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Sites') }}</h2>
        <p class="text-xs text-muted mt-0.5">{{ t('Per-domain aggregate over check runs.') }}</p>
      </div>
      <SelectField
        v-model.number="days"
        dense
        class="shrink-0"
        @update:modelValue="fetchAll(days)"
      >
        <option :value="7">{{ t('Last 7 days') }}</option>
        <option :value="30">{{ t('Last 30 days') }}</option>
        <option :value="90">{{ t('Last 90 days') }}</option>
        <option :value="365">{{ t('Last year') }}</option>
      </SelectField>
    </header>

    <DataTable
      :rows="state.sites"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openDetail"
      :empty-text="t('No sites checked in this range.')"
      :row-key="s => s.origin"
      min-width="900px"
    >
      <template #cell-origin="{ row: s }">
        <div class="min-w-0">
          <div class="font-medium truncate" :title="s.origin">{{ shortHost(s.origin) }}</div>
          <div class="text-[10px] text-muted/60 truncate">{{ s.origin }}</div>
        </div>
      </template>
      <template #cell-runs="{ row }"><CellNumber :value="row.run_count" /></template>
      <template #cell-users="{ row }"><CellNumber :value="row.unique_users" muted-when=">= 0" /></template>
      <template #cell-errors="{ row }"><CellNumber :value="row.error_total" error-when="> 0" /></template>
      <template #cell-warnings="{ row }"><CellNumber :value="row.warning_total" muted-when=">= 0" /></template>
      <template #cell-notes="{ row: s }">
        <CellBadge v-if="s.open_notes > 0" variant="status" value="info" :label="String(s.open_notes)" :class-name="'bg-primary/15 text-primary tabular-nums'" />
        <span v-else class="text-[10px] text-muted/40">—</span>
      </template>
      <template #cell-lastRun="{ row }"><CellTimestamp :value="row.last_run_at" mode="relative" /></template>
    </DataTable>
  </div>
</template>
