<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const { t } = useI18n()
const toast = useToast()

const snapshot = ref(null)
const loading  = ref(false)
const probing  = ref(false)
const error    = ref(null)

const BASE = `${API.admin.url}/health`

async function load() {
  loading.value = true
  error.value = null
  try {
    snapshot.value = await apiJson(BASE)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function refreshNow() {
  probing.value = true
  try {
    snapshot.value = await apiJson(`${BASE}/probe`, { method: 'POST' })
    toast.success(t('Probed all services'))
  } catch (e) { toast.error(e.message) }
  finally { probing.value = false }
}

let pollTimer = null
onMounted(() => {
  load()
  // Auto-refresh every 15s — the backend probes every 60s, so this just
  // pulls the latest in-memory snapshot. Cheap, no extra upstream load.
  pollTimer = setInterval(load, 15_000)
})
onBeforeUnmount(() => clearInterval(pollTimer))

const services = computed(() => snapshot.value?.services ?? [])
const okCount   = computed(() => services.value.filter(s => s.status === 'ok').length)
const failCount = computed(() => services.value.filter(s => s.status === 'fail').length)
const skipCount = computed(() => services.value.filter(s => s.status === 'skipped').length)

function statusColor(s) {
  switch (s) {
    case 'ok':       return 'bg-success/15 text-success border-success/40'
    case 'fail':     return 'bg-error/15   text-error   border-error/40'
    case 'skipped':  return 'bg-surface    text-muted   border-border/60'
    default:         return 'bg-surface    text-muted/60 border-border/40'
  }
}
function statusIcon(s) {
  switch (s) {
    case 'ok':      return 'mdiCheckCircleOutline'
    case 'fail':    return 'mdiAlertCircleOutline'
    case 'skipped': return 'mdiMinusCircleOutline'
    default:        return 'mdiHelpCircleOutline'
  }
}
function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return t('{n}s ago', { n: s })
  const m = Math.floor(s / 60)
  if (m < 60) return t('{n} min ago', { n: m })
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold">{{ t('Service status') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Health probes for upstream services. Probed every 60s, snapshot refreshes every 15s.') }}
        </p>
      </div>
      <BaseButton
        variant="pill"
        icon="mdiRefresh"
        :icon-size="13"
        :disabled="probing"
        class="bg-primary! border-primary! text-black/80!"
        @click="refreshNow"
      >{{ probing ? t('Probing…') : t('Refresh now') }}</BaseButton>
    </header>

    <div v-if="error" class="bg-error/10 border border-error/40 rounded-xl p-4 mb-4 text-sm text-error">{{ error }}</div>

    <section class="grid grid-cols-3 gap-3 mb-6">
      <KpiTile :label="t('Healthy')" :value="okCount"   tone="success" />
      <KpiTile :label="t('Failing')" :value="failCount" :tone="failCount ? 'error' : 'muted'" />
      <KpiTile :label="t('Skipped')" :value="skipCount" tone="muted" />
    </section>

    <!-- Per-service cards -->
    <div v-if="loading && !services.length" class="flex items-center justify-center py-12"><LoadingSpinner /></div>
    <p v-else-if="!services.length" class="text-center text-sm text-muted py-8 italic">
      {{ t('No probes registered.') }}
    </p>

    <ul v-else class="grid grid-cols-2 gap-3">
      <li v-for="s in services" :key="s.id" class="bg-surface-soft border rounded-xl p-4 flex items-start gap-3" :class="statusColor(s.status)">
        <Icon :name="statusIcon(s.status)" :size="20" class="shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold truncate flex-1">{{ s.label }}</h3>
            <code class="text-[10px] opacity-60">{{ s.id }}</code>
          </div>
          <p v-if="s.status === 'ok'" class="text-[11px] mt-1">
            {{ t('Responding in {n} ms', { n: s.latencyMs }) }}
          </p>
          <p v-else-if="s.status === 'fail'" class="text-[11px] mt-1">
            {{ s.error || t('Unknown error') }}
          </p>
          <p v-else class="text-[11px] mt-1">
            {{ s.reason || t('Not configured') }}
          </p>
          <p v-if="s.checkedAt" class="text-[10px] opacity-60 mt-2">{{ t('Checked') }}: {{ relative(s.checkedAt) }}</p>
        </div>
      </li>
    </ul>

    <p v-if="snapshot?.startedAt" class="text-[10px] text-muted/60 mt-6 text-center">
      {{ t('Probe loop started {ts}', { ts: new Date(snapshot.startedAt).toLocaleString() }) }}
    </p>
  </div>
</template>
