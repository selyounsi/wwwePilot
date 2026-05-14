<script setup>
import { onMounted, ref } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useAdminSites } from '@/admin/composables/useAdminSites.js'

const router = useRouter()
const { t } = useI18n()
const { state, fetchAll } = useAdminSites()

const days = ref(30)

onMounted(() => fetchAll(days.value))

function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 60)  return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)    return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}

function openDetail(origin) {
  router.push({ name: 'admin-site-detail', params: { origin: encodeURIComponent(origin) } })
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">{{ t('Sites') }}</h2>
        <p class="text-xs text-muted mt-0.5">{{ t('Per-domain aggregate over check runs.') }}</p>
      </div>
      <select
        v-model.number="days"
        @change="fetchAll(days)"
        class="bg-surface border border-border rounded px-2 py-1 text-xs"
      >
        <option :value="7">{{ t('Last 7 days') }}</option>
        <option :value="30">{{ t('Last 30 days') }}</option>
        <option :value="90">{{ t('Last 90 days') }}</option>
        <option :value="365">{{ t('Last year') }}</option>
      </select>
    </header>

    <div v-if="state.loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4 text-sm text-error">{{ state.error }}</div>

    <div v-else class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Origin') }}</th>
            <th class="text-right px-4 py-2.5 font-medium">{{ t('Runs') }}</th>
            <th class="text-right px-4 py-2.5 font-medium">{{ t('Users') }}</th>
            <th class="text-right px-4 py-2.5 font-medium">{{ t('Errors') }}</th>
            <th class="text-right px-4 py-2.5 font-medium">{{ t('Warnings') }}</th>
            <th class="text-right px-4 py-2.5 font-medium">{{ t('Notes') }}</th>
            <th class="text-right px-4 py-2.5 font-medium">{{ t('Last run') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in state.sites" :key="s.origin"
            @click="openDetail(s.origin)"
            class="border-t border-border/40 hover:bg-surface-soft-hover cursor-pointer"
          >
            <td class="px-4 py-2.5">
              <div class="font-medium truncate max-w-[300px]" :title="s.origin">{{ shortHost(s.origin) }}</div>
              <div class="text-[10px] text-muted/60 truncate max-w-[300px]">{{ s.origin }}</div>
            </td>
            <td class="px-4 py-2.5 text-right tabular-nums">{{ s.run_count }}</td>
            <td class="px-4 py-2.5 text-right tabular-nums text-muted">{{ s.unique_users }}</td>
            <td class="px-4 py-2.5 text-right tabular-nums" :class="s.error_total > 0 && 'text-error'">{{ s.error_total }}</td>
            <td class="px-4 py-2.5 text-right tabular-nums text-muted">{{ s.warning_total }}</td>
            <td class="px-4 py-2.5 text-right">
              <span
                v-if="s.open_notes > 0"
                class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary tabular-nums"
              >{{ s.open_notes }}</span>
              <span v-else class="text-[10px] text-muted/40">—</span>
            </td>
            <td class="px-4 py-2.5 text-right text-[11px] text-muted">{{ relative(s.last_run_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!state.sites.length" class="text-center text-muted py-8 text-sm">{{ t('No sites checked in this range.') }}</p>
    </div>
  </div>
</template>
