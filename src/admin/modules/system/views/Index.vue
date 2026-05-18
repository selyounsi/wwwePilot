<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useToast }        from '@/composables/useToast.js'
import { useAdminSystem } from '@/admin/modules/system/composables/useAdminSystem.js'

const { t } = useI18n()
const toast = useToast()
const { state, fetchStats, fetchBackups, createBackup, deleteBackup, downloadBackup, triggerBuild } = useAdminSystem()

const refreshTimer  = ref(null)
const backingUp     = ref(false)
const building      = ref(false)

onMounted(async () => {
  await Promise.all([fetchStats(), fetchBackups().catch(() => {})])
  refreshTimer.value = setInterval(fetchStats, 10_000)
})

onBeforeUnmount(() => {
  if (refreshTimer.value) clearInterval(refreshTimer.value)
})

function formatBytes(n) {
  if (!n && n !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

function formatDuration(sec) {
  if (sec < 60)        return `${sec}s`
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ${sec % 60}s`
  if (sec < 86_400)    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  const d = Math.floor(sec / 86_400)
  const h = Math.floor((sec % 86_400) / 3600)
  return `${d}d ${h}h`
}

import { relativeTime } from '@/admin/composables/timelineFormat.js'
function relative(ts) { return relativeTime(ts, t) }

const tablesColumns = [
  { key: 'name', label: 'Table', minWidth: 200 },
  { key: 'rows', label: 'Rows',  minWidth: 80, align: 'right' },
  { key: 'size', label: 'Size',  minWidth: 100, align: 'right' },
]

const backupsColumns = [
  { key: 'file',    label: 'Filename', minWidth: 240 },
  { key: 'size',    label: 'Size',     minWidth: 100, align: 'right' },
  { key: 'created', label: 'Created',  minWidth: 150, align: 'right' },
]

const heapPct = computed(() => {
  const m = state.stats?.process?.memory
  if (!m) return 0
  return Math.round((m.heapUsed / m.heapTotal) * 100)
})

const containerMemPct = computed(() => {
  const c = state.stats?.container
  if (!c || !c.limitBytes) return null
  return Math.round((c.currentBytes / c.limitBytes) * 100)
})

async function onBackup() {
  backingUp.value = true
  try {
    const r = await createBackup()
    toast.success(t('Backup created: {file} ({size})', { file: r.file, size: formatBytes(r.sizeBytes) }))
  } catch (e) { toast.error(e.message) }
  finally     { backingUp.value = false }
}

async function onDeleteBackup(b) {
  const typed = prompt(t('Type the backup filename "{file}" to confirm deletion:', { file: b.file }))
  if (typed !== b.file) {
    if (typed !== null) toast.error(t('Confirmation did not match — nothing deleted.'))
    return
  }
  try {
    await deleteBackup(b.file)
    toast.success(t('Backup deleted'))
  } catch (e) { toast.error(e.message) }
}

async function onDownload(b) {
  try { await downloadBackup(b.file) }
  catch (e) { toast.error(e.message) }
}

async function onTriggerBuild() {
  if (!confirm(t('Trigger an extension build now? Runs the same code path as the GitHub webhook.'))) return
  building.value = true
  try {
    await triggerBuild()
    toast.success(t('Build started — check server logs / Updates view for progress.'))
  } catch (e) { toast.error(e.message) }
  finally     { building.value = false }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">{{ t('System') }}</h2>
        <p class="text-xs text-muted mt-0.5">{{ t('Container resource usage + safe maintenance actions. Auto-refreshes every 10s.') }}</p>
      </div>
      <div class="inline-flex gap-1">
        <BaseButton variant="pill" icon="mdiHammerWrench" :icon-size="13" :loading="building" @click="onTriggerBuild">
          {{ t('Trigger extension build') }}
        </BaseButton>
        <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" icon="mdiDatabaseExport" :icon-size="13" :loading="backingUp" @click="onBackup">
          {{ t('Backup database') }}
        </BaseButton>
      </div>
    </header>

    <div v-if="state.loading && !state.stats" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4 text-sm text-error">{{ state.error }}</div>

    <div v-else-if="state.stats" class="space-y-6">
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          :label="t('Process uptime')"
          :value="formatDuration(state.stats.process.uptimeSec)"
          :sublabel="`PID ${state.stats.process.pid} · ${state.stats.process.nodeVersion}`"
        />
        <KpiTile
          :label="t('Heap used')"
          :value="formatBytes(state.stats.process.memory.heapUsed)"
          :sublabel="`${heapPct}% ${t('of')} ${formatBytes(state.stats.process.memory.heapTotal)} (${t('RSS')}: ${formatBytes(state.stats.process.memory.rss)})`"
        />
        <KpiTile :label="t('DB size')" :value="formatBytes(state.stats.db.sizeBytes)">
          <template #sublabel>
            {{ t('Pool') }}: {{ state.stats.db.pool.total - state.stats.db.pool.idle }}/{{ state.stats.db.pool.total }}
            <span v-if="state.stats.db.pool.waiting > 0" class="text-alert ml-1">· {{ state.stats.db.pool.waiting }} {{ t('waiting') }}</span>
          </template>
        </KpiTile>
        <KpiTile :label="t('Storage volume')" :value="formatBytes(state.stats.storage.bytes)" sublabel="_storage/" />
      </section>

      <!-- Container memory + DB activity -->
      <section class="bg-surface-soft border border-border rounded-xl p-4">
        <h3 class="font-semibold text-sm mb-3">{{ t('Container metrics') }}</h3>
        <div class="grid grid-cols-2 gap-4">
          <div v-if="state.stats.container">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Container memory') }}</div>
            <div class="text-sm mt-1">
              <span class="font-mono tabular-nums">{{ formatBytes(state.stats.container.currentBytes) }}</span>
              <template v-if="state.stats.container.limitBytes">
                <span class="text-muted"> {{ t('of') }} {{ formatBytes(state.stats.container.limitBytes) }}</span>
                <span class="text-muted/60 ml-1">({{ containerMemPct }}%)</span>
              </template>
              <span v-else class="text-muted ml-1 text-[11px]">({{ t('no limit set') }})</span>
            </div>
          </div>
          <div v-else>
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Container memory') }}</div>
            <div class="text-sm text-muted/60 mt-1">{{ t('cgroup data not available') }}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Active DB queries') }}</div>
            <div class="text-sm font-mono tabular-nums mt-1">{{ state.stats.db.activeQueries }}</div>
          </div>
        </div>
      </section>

      <div v-if="state.stats.db.tables.length">
        <h3 class="font-semibold text-sm mb-2">{{ t('Top tables') }}</h3>
        <DataTable
          :rows="state.stats.db.tables"
          :columns="tablesColumns"
          :row-key="t => t.name"
          dense
          min-width="500px"
        >
          <template #cell-name="{ row }"><CellCode :value="row.name" /></template>
          <template #cell-rows="{ row }"><CellNumber :value="row.rowCount" /></template>
          <template #cell-size="{ row }"><span class="text-[11px] tabular-nums">{{ formatBytes(row.sizeBytes) }}</span></template>
        </DataTable>
      </div>

      <!-- Background jobs -->
      <section v-if="Object.keys(state.stats.jobs.dashboardLastRefresh ?? {}).length" class="bg-surface-soft border border-border rounded-xl p-4">
        <h3 class="font-semibold text-sm mb-3">{{ t('Background jobs') }}</h3>
        <div class="grid grid-cols-3 gap-3 text-xs">
          <div v-for="(ts, view) in state.stats.jobs.dashboardLastRefresh" :key="view">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ view }}</div>
            <div class="mt-0.5">{{ relative(ts) }}</div>
          </div>
        </div>
      </section>

      <PanelCard v-if="state.stats.db.migrations.length" :title="t('Applied migrations')">
        <ItemList :items="state.stats.db.migrations" :row-key="m => m.filename">
          <template #item="{ item: m }">
            <ItemListRow>
              <code class="text-[11px] flex-1">{{ m.filename }}</code>
              <CellTimestamp :value="m.applied_at" mode="both" />
            </ItemListRow>
          </template>
        </ItemList>
      </PanelCard>

      <div>
        <h3 class="font-semibold text-sm mb-2">{{ t('Backups') }} ({{ state.backups.length }})</h3>
        <DataTable
          :rows="state.backups"
          :columns="backupsColumns"
          :row-key="b => b.file"
          :empty-text="t('No backups yet. Click “Backup database” above.')"
          dense
          min-width="600px"
        >
          <template #cell-file="{ row }"><CellCode :value="row.file" /></template>
          <template #cell-size="{ row }"><span class="text-[11px] tabular-nums">{{ formatBytes(row.sizeBytes) }}</span></template>
          <template #cell-created="{ row }"><CellTimestamp :value="row.createdAt" mode="both" /></template>
          <template #row-actions="{ row: b }">
            <div class="inline-flex gap-1">
              <BaseButton variant="pill" icon="mdiDownload" :icon-size="11" @click="onDownload(b)">{{ t('Download') }}</BaseButton>
              <BaseButton variant="pill" icon="mdiDelete" :icon-size="11" class="text-error! border-error/30! hover:bg-error/10!" @click="onDeleteBackup(b)">{{ t('Delete') }}</BaseButton>
            </div>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>
