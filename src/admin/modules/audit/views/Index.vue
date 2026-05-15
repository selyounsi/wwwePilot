<script setup>
import { onMounted } from 'vue'
import { useI18n }        from '@/composables/i18n/useI18n.js'
import { useAdminAudit } from '@/admin/modules/audit/composables/useAdminAudit.js'

const { t } = useI18n()
const { state, fetchAll } = useAdminAudit()

onMounted(() => fetchAll({ limit: 100 }))

function formatTime(ts) {
  return new Date(ts).toLocaleString()
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
</script>

<template>
  <div class="p-6">
    <header class="mb-6">
      <h2 class="text-xl font-bold">{{ t('Admin audit') }}</h2>
      <p class="text-xs text-muted mt-0.5">
        {{ t('Append-only trail of state-changing admin actions. Read-only.') }}
      </p>
    </header>

    <div v-if="state.loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4">
      <p class="text-sm text-error">{{ state.error }}</p>
    </div>

    <div v-else class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Time') }}</th>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Actor') }}</th>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Action') }}</th>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Target / Payload') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="ev in state.events" :key="ev.id"
            class="border-t border-border/40 hover:bg-surface-soft-hover"
          >
            <td class="px-4 py-2 text-[11px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(ev.createdAt) }}</td>
            <td class="px-4 py-2 text-[11px] text-muted font-mono">{{ (ev.userId ?? '—').slice(0, 8) }}</td>
            <td class="px-4 py-2"><code class="text-[11px] text-primary">{{ ev.action }}</code></td>
            <td class="px-4 py-2 text-[11px] text-muted">{{ summarize(ev) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!state.events.length" class="text-center text-muted py-8 text-sm">{{ t('No audit events yet.') }}</p>
    </div>
  </div>
</template>
