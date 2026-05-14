<script setup>
import { onMounted, ref } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useAdminRuns }  from '@/admin/composables/useAdminRuns.js'

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

function formatTime(ts) { return new Date(ts).toLocaleString() }

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}

function userLabel(r) {
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  return r.email || (r.user_id ? r.user_id.slice(0, 8) : '—')
}

function duration(r) {
  if (!r.finished_at) return '—'
  const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}min`
}

function statusColor(s) {
  switch (s) {
    case 'running':   return 'bg-primary/15 text-primary'
    case 'finished':  return 'bg-success/15 text-success'
    case 'cancelled': return 'bg-alert/15  text-alert'
    case 'aborted':   return 'bg-error/15  text-error'
    default:          return 'bg-surface   text-light'
  }
}
function statusLabel(s) {
  switch (s) {
    case 'running':   return t('Running')
    case 'finished':  return t('Finished')
    case 'cancelled': return t('Cancelled')
    case 'aborted':   return t('Aborted')
    default:          return s
  }
}

function openRun(id) {
  router.push({ name: 'admin-run-detail', params: { id } })
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6">
      <h2 class="text-xl font-bold">{{ t('Check runs') }}</h2>
      <p class="text-xs text-muted mt-0.5">
        {{ t('One row per "Prüfen"-click. Expand to see per-module breakdown.') }}
      </p>
    </header>

    <section class="bg-surface-soft border border-border rounded-xl">
      <div class="px-4 py-3 border-b border-border/60 flex flex-wrap gap-2 items-center">
        <input
          v-model="filterUser"
          :placeholder="t('User-ID')"
          class="bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono w-72 focus:outline-none focus:border-primary/60"
        />
        <input
          v-model="filterOrigin"
          :placeholder="t('Origin (e.g. https://example.com)')"
          class="bg-surface border border-border rounded px-2 py-1.5 text-xs w-72 focus:outline-none focus:border-primary/60"
        />
        <select v-model="filterKind" class="bg-surface border border-border rounded px-2 py-1.5 text-xs">
          <option value="">{{ t('All kinds') }}</option>
          <option value="single-page">{{ t('Single-page') }}</option>
          <option value="site-wide">{{ t('Site-wide') }}</option>
        </select>
        <select v-model="filterStatus" class="bg-surface border border-border rounded px-2 py-1.5 text-xs">
          <option value="">{{ t('All statuses') }}</option>
          <option value="running">{{ t('Running') }}</option>
          <option value="finished">{{ t('Finished') }}</option>
          <option value="cancelled">{{ t('Cancelled') }}</option>
          <option value="aborted">{{ t('Aborted') }}</option>
        </select>
        <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="applyFilter">{{ t('Apply') }}</BaseButton>
      </div>

      <div v-if="state.loading" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <div v-else-if="state.error" class="p-4 text-error text-sm">{{ state.error }}</div>

      <div v-else>
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-3 py-2 font-medium">{{ t('When') }}</th>
              <th class="text-left px-3 py-2 font-medium">{{ t('User') }}</th>
              <th class="text-left px-3 py-2 font-medium">{{ t('Kind') }}</th>
              <th class="text-left px-3 py-2 font-medium">{{ t('Status') }}</th>
              <th class="text-left px-3 py-2 font-medium">{{ t('Origin') }}</th>
              <th class="text-right px-3 py-2 font-medium">{{ t('Pages') }}</th>
              <th class="text-right px-3 py-2 font-medium">{{ t('Modules') }}</th>
              <th class="text-right px-3 py-2 font-medium">{{ t('Errors') }}</th>
              <th class="text-right px-3 py-2 font-medium">{{ t('Warnings') }}</th>
              <th class="text-right px-3 py-2 font-medium">{{ t('Duration') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in state.runs" :key="r.id"
              @click="openRun(r.id)"
              class="border-t border-border/40 hover:bg-surface-soft-hover cursor-pointer"
            >
              <td class="px-3 py-2 text-[11px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(r.started_at) }}</td>
              <td class="px-3 py-2 text-[11px]">{{ userLabel(r) }}</td>
              <td class="px-3 py-2">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="r.kind === 'site-wide' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
                >{{ r.kind === 'site-wide' ? t('Site-wide') : t('Single') }}</span>
              </td>
              <td class="px-3 py-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded" :class="statusColor(r.status)">
                  {{ statusLabel(r.status) }}
                </span>
              </td>
              <td class="px-3 py-2 text-[11px] max-w-50 truncate" :title="r.origin">{{ shortHost(r.origin) }}</td>
              <td class="px-3 py-2 text-[11px] text-right tabular-nums">{{ r.pages_count }}</td>
              <td class="px-3 py-2 text-[11px] text-right tabular-nums">{{ (r.modules ?? []).length }}</td>
              <td class="px-3 py-2 text-[11px] text-right tabular-nums" :class="r.total_errors > 0 && 'text-error'">{{ r.total_errors }}</td>
              <td class="px-3 py-2 text-[11px] text-right tabular-nums text-muted">{{ r.total_warnings }}</td>
              <td class="px-3 py-2 text-[11px] text-right text-muted">{{ duration(r) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!state.runs.length" class="text-center text-muted py-8 text-sm">{{ t('No runs yet.') }}</p>
        <div v-else-if="state.hasMore" class="px-4 py-3 text-center border-t border-border/40">
          <BaseButton variant="pill" @click="loadMore">{{ t('Load more') }}</BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
