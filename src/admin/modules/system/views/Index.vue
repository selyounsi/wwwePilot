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

function formatTime(ts) { return ts ? new Date(ts).toLocaleString() : '—' }

function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return t('just now')
  if (min < 60) return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)   return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

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
      <!-- KPI row -->
      <section class="grid grid-cols-4 gap-3">
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Process uptime') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatDuration(state.stats.process.uptimeSec) }}</div>
          <div class="text-[11px] text-muted mt-1">PID {{ state.stats.process.pid }} · {{ state.stats.process.nodeVersion }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Heap used') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatBytes(state.stats.process.memory.heapUsed) }}</div>
          <div class="text-[11px] text-muted mt-1">{{ heapPct }}% {{ t('of') }} {{ formatBytes(state.stats.process.memory.heapTotal) }} ({{ t('RSS') }}: {{ formatBytes(state.stats.process.memory.rss) }})</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('DB size') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatBytes(state.stats.db.sizeBytes) }}</div>
          <div class="text-[11px] text-muted mt-1">
            {{ t('Pool') }}: {{ state.stats.db.pool.total - state.stats.db.pool.idle }}/{{ state.stats.db.pool.total }}
            <span v-if="state.stats.db.pool.waiting > 0" class="text-alert ml-1">· {{ state.stats.db.pool.waiting }} {{ t('waiting') }}</span>
          </div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Storage volume') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ formatBytes(state.stats.storage.bytes) }}</div>
          <div class="text-[11px] text-muted mt-1">_storage/</div>
        </div>
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

      <!-- Top tables -->
      <section v-if="state.stats.db.tables.length" class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60">
          <h3 class="font-semibold text-sm">{{ t('Top tables') }}</h3>
        </header>
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('Table') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Rows') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Size') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tbl in state.stats.db.tables" :key="tbl.name" class="border-t border-border/30">
              <td class="px-4 py-2"><code class="text-[11px]">{{ tbl.name }}</code></td>
              <td class="px-4 py-2 text-right text-[11px] tabular-nums">{{ tbl.rowCount.toLocaleString() }}</td>
              <td class="px-4 py-2 text-right text-[11px] tabular-nums">{{ formatBytes(tbl.sizeBytes) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

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

      <!-- Migrations -->
      <section v-if="state.stats.db.migrations.length" class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60">
          <h3 class="font-semibold text-sm">{{ t('Applied migrations') }}</h3>
        </header>
        <ul class="divide-y divide-border/30">
          <li v-for="m in state.stats.db.migrations" :key="m.filename" class="px-4 py-2 flex items-center gap-3 text-xs">
            <code class="text-[11px] flex-1">{{ m.filename }}</code>
            <span class="text-[10px] text-muted">{{ formatTime(m.applied_at) }}</span>
          </li>
        </ul>
      </section>

      <!-- Backups -->
      <section class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 class="font-semibold text-sm">{{ t('Backups') }} ({{ state.backups.length }})</h3>
        </header>
        <table v-if="state.backups.length" class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('Filename') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Size') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Created') }}</th>
              <th class="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in state.backups" :key="b.file" class="border-t border-border/30 hover:bg-surface-soft-hover">
              <td class="px-4 py-2"><code class="text-[11px]">{{ b.file }}</code></td>
              <td class="px-4 py-2 text-right text-[11px] tabular-nums">{{ formatBytes(b.sizeBytes) }}</td>
              <td class="px-4 py-2 text-right text-[11px] text-muted">{{ formatTime(b.createdAt) }}</td>
              <td class="px-4 py-2 text-right">
                <div class="inline-flex gap-1">
                  <BaseButton variant="pill" icon="mdiDownload" :icon-size="11" @click="onDownload(b)">{{ t('Download') }}</BaseButton>
                  <BaseButton variant="pill" icon="mdiDelete" :icon-size="11" class="text-error! border-error/30! hover:bg-error/10!" @click="onDeleteBackup(b)">{{ t('Delete') }}</BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-4 py-6 text-center text-sm text-muted">{{ t('No backups yet. Click "Backup database" above.') }}</p>
      </section>
    </div>
  </div>
</template>
