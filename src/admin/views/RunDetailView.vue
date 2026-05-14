<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useToast }      from '@/composables/useToast.js'
import { useAdminRuns }  from '@/admin/composables/useAdminRuns.js'
import { usePermissions } from '@/composables/usePermissions.js'

const route   = useRoute()
const router  = useRouter()
const { t } = useI18n()
const toast = useToast()
const { fetchDetail, remove } = useAdminRuns()
const { canWriteUsers }       = usePermissions()

const data    = ref(null)
const loading = ref(false)
const error   = ref(null)

const id = computed(() => String(route.params.id ?? ''))

async function load() {
  loading.value = true
  error.value   = null
  try {
    data.value = await fetchDetail(id.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(id, load)

function userLabel(r) {
  if (!r) return '—'
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  return r.email || (r.user_id ? r.user_id.slice(0, 8) : '—')
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

function duration() {
  const r = data.value?.run
  if (!r?.started_at) return '—'
  const end = r.finished_at ? new Date(r.finished_at).getTime() : Date.now()
  const ms  = end - new Date(r.started_at).getTime()
  if (ms < 1000)   return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}min`
}

function formatTime(ts) {
  return ts ? new Date(ts).toLocaleString() : '—'
}

async function onDelete() {
  const r = data.value?.run
  if (!r) return
  const expected = r.id.slice(0, 8)
  const typed = prompt(t('Type the run-ID short code "{code}" to confirm deletion. This is permanent.', { code: expected }))
  if (typed !== expected) {
    if (typed !== null) toast.error(t('Confirmation did not match — nothing deleted.'))
    return
  }
  try {
    await remove(r.id)
    toast.success(t('Run deleted'))
    router.replace({ name: 'admin-runs' })
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center gap-3">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.back()">
        {{ t('Back') }}
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold">{{ t('Check run details') }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ id }}</p>
      </div>
      <BaseButton
        v-if="canWriteUsers && data?.run"
        variant="pill"
        icon="mdiDelete"
        :icon-size="13"
        class="text-error! border-error/30! hover:bg-error/10!"
        @click="onDelete"
      >
        {{ t('Delete run') }}
      </BaseButton>
    </header>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="bg-error/10 border border-error/40 rounded-xl p-4 text-sm text-error">{{ error }}</div>

    <div v-else-if="data?.run" class="space-y-6">
      <!-- Header card -->
      <section class="bg-surface-soft border border-border rounded-xl p-4 grid grid-cols-4 gap-4">
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Status') }}</div>
          <div class="mt-1">
            <span class="text-xs px-2 py-1 rounded font-semibold" :class="statusColor(data.run.status)">
              {{ statusLabel(data.run.status) }}
            </span>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Kind') }}</div>
          <div class="mt-1 text-sm font-medium">
            {{ data.run.kind === 'site-wide' ? t('Site-wide') : t('Single-page') }}
            <span v-if="data.run.kind === 'site-wide'" class="text-muted">
              ({{ t('{n} pages', { n: data.run.pages_count }) }})
            </span>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('User') }}</div>
          <div class="mt-1 text-sm font-medium">{{ userLabel(data.run) }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Duration') }}</div>
          <div class="mt-1 text-sm font-medium tabular-nums">{{ duration() }}</div>
        </div>
        <div class="col-span-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Origin') }}</div>
          <div class="mt-1 text-sm font-mono">{{ data.run.origin }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Started') }}</div>
          <div class="mt-1 text-xs">{{ formatTime(data.run.started_at) }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Finished') }}</div>
          <div class="mt-1 text-xs">{{ formatTime(data.run.finished_at) }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Total errors') }}</div>
          <div class="mt-1 text-sm font-medium tabular-nums" :class="data.run.total_errors > 0 && 'text-error'">
            {{ data.run.total_errors }}
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Total warnings') }}</div>
          <div class="mt-1 text-sm font-medium tabular-nums">{{ data.run.total_warnings }}</div>
        </div>
      </section>

      <!-- Per-module sections -->
      <section
        v-for="m in data.modules" :key="m.module_id"
        class="bg-surface-soft border border-border rounded-xl overflow-hidden"
      >
        <header class="px-4 py-3 border-b border-border/60 flex items-center gap-3">
          <code class="text-sm font-semibold">{{ m.module_id }}</code>
          <span class="text-[11px] text-muted">{{ m.duration_ms ?? '—' }}ms</span>
          <span class="ml-auto inline-flex gap-2">
            <span
              v-if="m.error_count > 0"
              class="text-[11px] px-1.5 py-0.5 rounded bg-error/15 text-error tabular-nums"
            >{{ t('{n} errors', { n: m.error_count }) }}</span>
            <span
              v-if="m.warning_count > 0"
              class="text-[11px] px-1.5 py-0.5 rounded bg-alert/15 text-alert tabular-nums"
            >{{ t('{n} warnings', { n: m.warning_count }) }}</span>
            <span
              v-if="m.error_count === 0 && m.warning_count === 0"
              class="text-[11px] px-1.5 py-0.5 rounded bg-success/15 text-success"
            >{{ t('OK') }}</span>
          </span>
        </header>

        <div v-if="m.issues?.errors?.length || m.issues?.warnings?.length" class="px-4 py-2 divide-y divide-border/30">
          <div v-if="m.issues?.errors?.length" class="py-2">
            <div class="text-[10px] uppercase tracking-wide text-error/70 mb-1">{{ t('Errors') }}</div>
            <ul class="space-y-1">
              <li v-for="(e, i) in m.issues.errors" :key="i" class="text-xs flex items-start gap-2">
                <Icon name="mdiAlertCircle" :size="12" class="text-error shrink-0 mt-0.5" />
                <span class="text-light">{{ e.message }}</span>
              </li>
            </ul>
          </div>
          <div v-if="m.issues?.warnings?.length" class="py-2">
            <div class="text-[10px] uppercase tracking-wide text-alert/70 mb-1">{{ t('Warnings') }}</div>
            <ul class="space-y-1">
              <li v-for="(w, i) in m.issues.warnings" :key="i" class="text-xs flex items-start gap-2">
                <Icon name="mdiAlertOutline" :size="12" class="text-alert shrink-0 mt-0.5" />
                <span class="text-light">{{ w.message }}</span>
              </li>
            </ul>
          </div>
        </div>
        <div v-else-if="m.error_count === 0 && m.warning_count === 0" class="px-4 py-3 text-sm text-muted">
          {{ t('No issues found.') }}
        </div>
        <div v-else class="px-4 py-3 text-sm text-muted/60 italic">
          {{ t('No detail payload — this module ran before issue capture was enabled.') }}
        </div>
      </section>
    </div>
  </div>
</template>
