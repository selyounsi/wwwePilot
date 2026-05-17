<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useToast }  from '@/composables/useToast.js'
import { useUserRuns } from '../composables/useUserRuns.js'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { state, fetchOrigins, fetchRuns, fetchDetail, deleteRun } = useUserRuns()

// Three view modes on a single page:
//   - 'origins'  list of all my origins
//   - 'runs'     runs for a picked origin
//   - 'detail'   full per-module breakdown of a single run
// Drilling down keeps the back stack manageable inside the side panel.
const mode        = ref('origins')
const activeOrig  = ref('')
const activeRunId = ref('')

// Custom confirm state for the delete action.
const confirmOpen   = ref(false)
const pendingDelete = ref(null)

onMounted(fetchOrigins)

watch(activeOrig, (o) => {
  if (o) fetchRuns({ origin: o })
})
watch(activeRunId, (id) => {
  if (id) fetchDetail(id)
})

function openOrigin(origin) {
  activeOrig.value = origin
  mode.value = 'runs'
}

function openRun(id) {
  activeRunId.value = id
  mode.value = 'detail'
}

function backToRuns() {
  activeRunId.value = ''
  mode.value = 'runs'
}
function backToOrigins() {
  activeOrig.value  = ''
  activeRunId.value = ''
  mode.value = 'origins'
  fetchOrigins()
}

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}
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
function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}
function duration(run) {
  if (!run.finishedAt) return '—'
  const start = new Date(run.startedAt).getTime()
  const end   = new Date(run.finishedAt).getTime()
  const s = Math.max(0, Math.round((end - start) / 1000))
  return s < 60 ? `${s}s` : `${Math.round(s / 60)} min`
}
function statusColor(s) {
  switch (s) {
    case 'finished':  return 'text-success'
    case 'running':   return 'text-primary'
    case 'cancelled': return 'text-alert'
    case 'aborted':   return 'text-error'
    default:          return 'text-muted'
  }
}

function askDelete(run) {
  pendingDelete.value = run
  confirmOpen.value = true
}
async function confirmDelete() {
  const run = pendingDelete.value
  if (!run) return
  // Switch *before* the await so the detail view's "Run not found." doesn't
  // flash for a frame while state.detail is null but mode is still 'detail'.
  if (mode.value === 'detail' && activeRunId.value === run.id) backToRuns()
  try {
    await deleteRun(run.id)
    toast.success(t('Check deleted'))
    // If we just emptied the run list for this origin, jump back up so the
    // user isn't stranded on an empty page.
    if (mode.value === 'runs' && !state.runs.length) backToOrigins()
  } catch (e) { toast.error(e.message) }
  finally { pendingDelete.value = null }
}

// Restore: navigate back to the service home — the check store could
// later be hydrated from `state.detail` to "replay" the past result, but
// that's a follow-up; for now we just send the user to re-check.
function recheckOrigin() {
  router.push('/service/web-checker')
}
</script>

<template>
  <div class="h-full bg-background flex flex-col">
    <AppHeader showBack />

    <div class="flex-1 px-4 py-4 overflow-y-auto">
      <header class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-base font-semibold">{{ t('Previous checks') }}</h2>
          <p class="text-[11px] text-muted/70">{{ t('Your own check history.') }}</p>
        </div>
      </header>

      <div v-if="state.error" class="bg-error/10 border border-error/40 rounded-lg p-3 mb-3 text-xs text-error">
        {{ state.error }}
      </div>

      <!-- Mode: origins -->
      <template v-if="mode === 'origins'">
        <div v-if="state.loadingOrigins" class="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
        <p v-else-if="!state.origins.length" class="text-center text-xs text-muted/60 italic py-8">
          {{ t('No checks yet. Run one to see it here.') }}
        </p>
        <ul v-else class="space-y-1.5">
          <li
            v-for="o in state.origins" :key="o.origin"
            class="bg-surface-soft border border-border rounded-lg px-3 py-2.5 cursor-pointer hover:bg-surface-soft-hover transition-colors"
            @click="openOrigin(o.origin)"
          >
            <div class="flex items-center gap-2">
              <Icon name="mdiWeb" :size="14" class="text-primary shrink-0" />
              <div class="text-xs truncate flex-1">{{ shortHost(o.origin) }}</div>
              <Icon name="mdiChevronRight" :size="14" class="text-muted shrink-0" />
            </div>
            <div class="flex items-center justify-between mt-1 text-[10px] text-muted">
              <span>{{ t('{n} checks', { n: o.runCount }) }} · {{ relative(o.lastRun) }}</span>
              <span v-if="o.totalErrors > 0" class="text-error tabular-nums">{{ o.totalErrors }} {{ t('errors') }}</span>
            </div>
          </li>
        </ul>
      </template>

      <!-- Mode: runs -->
      <template v-else-if="mode === 'runs'">
        <button class="flex items-center gap-1 text-[11px] text-muted hover:text-light mb-3" @click="backToOrigins">
          <Icon name="mdiArrowLeft" :size="12" />
          {{ t('All sites') }}
        </button>
        <div class="bg-surface-soft border border-border rounded-lg p-3 mb-3">
          <div class="flex items-center gap-2">
            <Icon name="mdiWeb" :size="14" class="text-primary" />
            <div class="text-xs font-semibold truncate flex-1">{{ shortHost(activeOrig) }}</div>
            <BaseButton variant="pill" icon="mdiPlayCircleOutline" :icon-size="11" @click="recheckOrigin">
              {{ t('Recheck') }}
            </BaseButton>
          </div>
        </div>

        <div v-if="state.loadingRuns" class="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
        <p v-else-if="!state.runs.length" class="text-center text-xs text-muted/60 italic py-8">
          {{ t('No checks for this site.') }}
        </p>
        <ul v-else class="space-y-1.5">
          <li
            v-for="r in state.runs" :key="r.id"
            class="bg-surface-soft border border-border rounded-lg px-3 py-2.5"
          >
            <div class="flex items-center gap-2 mb-1 cursor-pointer" @click="openRun(r.id)">
              <Icon
                :name="r.kind === 'site-wide' ? 'mdiWebSync' : 'mdiFileDocumentOutline'"
                :size="13"
                class="text-muted shrink-0"
              />
              <div class="text-[11px] flex-1 truncate">{{ fmtDateTime(r.startedAt) }}</div>
              <span class="text-[10px]" :class="statusColor(r.status)">{{ t(r.status) }}</span>
              <Icon name="mdiChevronRight" :size="12" class="text-muted/60" />
            </div>
            <div class="flex items-center justify-between text-[10px] text-muted">
              <span>
                <span v-if="r.kind === 'site-wide'">{{ r.pagesCount }} {{ t('pages') }} · </span>
                {{ duration(r) }}
                <span v-if="(r.modulesRun ?? []).length">· {{ r.modulesRun.length }} {{ t('modules') }}</span>
              </span>
              <div class="flex items-center gap-2">
                <span v-if="r.totalErrors > 0" class="text-error tabular-nums">{{ r.totalErrors }} {{ t('errors') }}</span>
                <span v-if="r.totalWarnings > 0" class="text-alert tabular-nums">{{ r.totalWarnings }} {{ t('warnings') }}</span>
                <button
                  class="p-1 rounded hover:bg-error/10 text-error/60 hover:text-error transition-colors"
                  :title="t('Delete')"
                  @click.stop="askDelete(r)"
                >
                  <Icon name="mdiDelete" :size="11" />
                </button>
              </div>
            </div>
          </li>
        </ul>
      </template>

      <!-- Mode: detail -->
      <template v-else-if="mode === 'detail'">
        <button class="flex items-center gap-1 text-[11px] text-muted hover:text-light mb-3" @click="backToRuns">
          <Icon name="mdiArrowLeft" :size="12" />
          {{ t('Back to runs') }}
        </button>

        <div v-if="state.loadingDetail" class="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
        <p v-else-if="!state.detail" class="text-center text-xs text-muted/60 italic py-8">
          {{ t('Run not found.') }}
        </p>
        <template v-else>
          <div class="bg-surface-soft border border-border rounded-lg p-3 mb-3">
            <div class="flex items-center gap-2 mb-2">
              <Icon
                :name="state.detail.run.kind === 'site-wide' ? 'mdiWebSync' : 'mdiFileDocumentOutline'"
                :size="14"
                class="text-primary shrink-0"
              />
              <div class="text-xs font-semibold truncate flex-1">{{ shortHost(state.detail.run.origin) }}</div>
              <span class="text-[10px]" :class="statusColor(state.detail.run.status)">{{ t(state.detail.run.status) }}</span>
            </div>
            <div class="text-[10px] text-muted">{{ fmtDateTime(state.detail.run.startedAt) }} · {{ duration(state.detail.run) }}</div>
            <div class="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <div class="text-[9px] uppercase tracking-wide text-muted/60">{{ t('Errors') }}</div>
                <div class="text-base font-bold tabular-nums text-error">{{ state.detail.run.totalErrors ?? 0 }}</div>
              </div>
              <div>
                <div class="text-[9px] uppercase tracking-wide text-muted/60">{{ t('Warnings') }}</div>
                <div class="text-base font-bold tabular-nums text-alert">{{ state.detail.run.totalWarnings ?? 0 }}</div>
              </div>
              <div>
                <div class="text-[9px] uppercase tracking-wide text-muted/60">{{ t('Modules') }}</div>
                <div class="text-base font-bold tabular-nums">{{ state.detail.modules.length }}</div>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 mt-3">
              <BaseButton variant="pill" icon="mdiPlayCircleOutline" :icon-size="11" @click="recheckOrigin">
                {{ t('Recheck this site') }}
              </BaseButton>
              <button
                class="p-1.5 rounded hover:bg-error/10 text-error/60 hover:text-error transition-colors"
                :title="t('Delete this check')"
                @click="askDelete(state.detail.run)"
              >
                <Icon name="mdiDelete" :size="13" />
              </button>
            </div>
          </div>

          <ul v-if="state.detail.modules.length" class="space-y-1.5">
            <li v-for="m in state.detail.modules" :key="m.moduleId" class="bg-surface-soft border border-border rounded-lg px-3 py-2">
              <div class="flex items-center gap-2">
                <code class="text-[11px] text-light flex-1">{{ m.moduleId }}</code>
                <span v-if="m.errorCount > 0" class="text-[10px] text-error tabular-nums">{{ m.errorCount }} {{ t('err.') }}</span>
                <span v-if="m.warningCount > 0" class="text-[10px] text-alert tabular-nums">{{ m.warningCount }} {{ t('warn.') }}</span>
                <span v-if="m.durationMs" class="text-[10px] text-muted">{{ m.durationMs }}ms</span>
              </div>
              <ul v-if="m.issues?.errors?.length || m.issues?.warnings?.length" class="mt-1.5 space-y-0.5 pl-2">
                <li v-for="(i, idx) in (m.issues?.errors ?? []).slice(0, 5)" :key="`e-${idx}`" class="text-[10px] text-error/80 leading-tight">
                  · {{ i.message }}
                </li>
                <li v-for="(i, idx) in (m.issues?.warnings ?? []).slice(0, 5)" :key="`w-${idx}`" class="text-[10px] text-alert/80 leading-tight">
                  · {{ i.message }}
                </li>
                <li
                  v-if="((m.issues?.errors?.length ?? 0) + (m.issues?.warnings?.length ?? 0)) > 10"
                  class="text-[10px] text-muted/60 italic"
                >
                  + {{ (m.issues?.errors?.length ?? 0) + (m.issues?.warnings?.length ?? 0) - 10 }} {{ t('more') }}
                </li>
              </ul>
            </li>
          </ul>
        </template>
      </template>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      :title="t('Delete this check?')"
      :message="pendingDelete ? t('From {when}', { when: fmtDateTime(pendingDelete.startedAt) }) : ''"
      :confirm-text="t('Delete')"
      variant="danger"
      @update:open="confirmOpen = $event"
      @confirm="confirmDelete"
    />
  </div>
</template>
