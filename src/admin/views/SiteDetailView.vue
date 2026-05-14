<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useToast }      from '@/composables/useToast.js'
import { useAdminSites } from '@/admin/composables/useAdminSites.js'
import { useSiteNotes }  from '@/composables/useSiteNotes.js'
import { usePermissions } from '@/composables/usePermissions.js'

const router = useRouter()
const route  = useRoute()
const { t } = useI18n()
const toast = useToast()
const { detailState, fetchDetail, purge } = useAdminSites()
const { createNote, updateNote, deleteNote, ensureLoaded } = useSiteNotes()
const { canWriteUsers } = usePermissions()

const origin = computed(() => decodeURIComponent(String(route.params.origin ?? '')))

const adding   = ref(false)
const draft    = ref({ content: '', scopePath: '', moduleId: '' })

async function load() {
  if (!origin.value) return
  await fetchDetail(origin.value)
  await ensureLoaded(origin.value, { force: true })
}

onMounted(load)
watch(origin, load)

function formatTime(ts) { return ts ? new Date(ts).toLocaleString() : '—' }

function userLabel(r) {
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  return r.email || (r.user_id ? r.user_id.slice(0, 8) : '—')
}

const activeNotes = computed(() =>
  (detailState.detail?.notes ?? []).filter(n => !n.resolved_at),
)
const resolvedNotes = computed(() =>
  (detailState.detail?.notes ?? []).filter(n =>  n.resolved_at),
)

async function onAdd() {
  if (!draft.value.content.trim()) return
  try {
    await createNote({
      origin:    origin.value,
      scopePath: draft.value.scopePath.trim() || null,
      moduleId:  draft.value.moduleId.trim()  || null,
      content:   draft.value.content.trim(),
    })
    draft.value  = { content: '', scopePath: '', moduleId: '' }
    adding.value = false
    toast.success(t('Note saved'))
    await fetchDetail(origin.value)
  } catch (e) { toast.error(e.message) }
}

async function onResolve(note) {
  try {
    await updateNote(note.id, { resolve: true })
    await fetchDetail(origin.value)
  } catch (e) { toast.error(e.message) }
}

async function onUnresolve(note) {
  try {
    await updateNote(note.id, { resolve: false })
    await fetchDetail(origin.value)
  } catch (e) { toast.error(e.message) }
}

async function onDelete(note) {
  if (!confirm(t('Delete this note?'))) return
  try {
    await deleteNote(note.id, origin.value)
    await fetchDetail(origin.value)
  } catch (e) { toast.error(e.message) }
}

function shortHost() {
  try { return new URL(origin.value).host } catch { return origin.value }
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

async function onPurgeSite() {
  const typed = prompt(t('Purging deletes ALL runs, notes and events for "{o}". Type the full origin to confirm:', { o: origin.value }))
  if (typed !== origin.value) {
    if (typed !== null) toast.error(t('Confirmation did not match — nothing deleted.'))
    return
  }
  try {
    const r = await purge(origin.value)
    toast.success(t('Site purged ({n} runs, {m} notes)', { n: r?.runs_deleted ?? 0, m: r?.notes_deleted ?? 0 }))
    router.replace({ name: 'admin-sites' })
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
        <h2 class="text-xl font-bold truncate">{{ shortHost() }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ origin }}</p>
      </div>
      <BaseButton
        v-if="canWriteUsers"
        variant="pill"
        icon="mdiDeleteSweep"
        :icon-size="13"
        class="text-error! border-error/30! hover:bg-error/10!"
        @click="onPurgeSite"
      >
        {{ t('Purge site') }}
      </BaseButton>
    </header>

    <div v-if="detailState.loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="detailState.error" class="bg-error/10 border border-error/40 rounded-xl p-4 text-sm text-error">{{ detailState.error }}</div>

    <div v-else-if="detailState.detail" class="space-y-6">
      <!-- Aggregate KPIs -->
      <section v-if="detailState.detail.aggregate" class="grid grid-cols-4 gap-3">
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Total runs') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ detailState.detail.aggregate.run_count }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Unique users') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ detailState.detail.aggregate.unique_users }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Errors (sum)') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1 text-error">{{ detailState.detail.aggregate.error_total }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Warnings (sum)') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ detailState.detail.aggregate.warning_total }}</div>
        </div>
      </section>

      <!-- Notes -->
      <section class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 class="font-semibold text-sm">{{ t('Notes') }} ({{ activeNotes.length }})</h3>
          <BaseButton v-if="!adding" variant="pill" icon="mdiPlus" :icon-size="13" @click="adding = true">
            {{ t('Add note') }}
          </BaseButton>
        </header>

        <div v-if="adding" class="p-4 border-b border-border/40 bg-primary/5">
          <textarea
            v-model="draft.content"
            rows="3"
            :placeholder="t('Note content…')"
            class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:border-primary/60"
          />
          <div class="mt-2 flex gap-2">
            <input
              v-model="draft.scopePath"
              :placeholder="t('Path (optional, e.g. /about)')"
              class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/60"
            />
            <input
              v-model="draft.moduleId"
              :placeholder="t('Module (optional)')"
              class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/60"
            />
          </div>
          <div class="mt-2 flex justify-end gap-2">
            <BaseButton variant="pill" @click="adding = false; draft = { content: '', scopePath: '', moduleId: '' }">
              {{ t('Cancel') }}
            </BaseButton>
            <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="onAdd">{{ t('Save') }}</BaseButton>
          </div>
        </div>

        <div v-if="!activeNotes.length && !adding" class="px-4 py-6 text-center text-sm text-muted">
          {{ t('No active notes for this site.') }}
        </div>

        <div v-for="n in activeNotes" :key="n.id" class="px-4 py-3 border-b border-border/30 last:border-b-0">
          <p class="text-sm whitespace-pre-wrap">{{ n.content }}</p>
          <div class="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <span>{{ userLabel(n) }}</span>
            <span>·</span>
            <span>{{ formatTime(n.created_at) }}</span>
            <code v-if="n.scope_path" class="text-[10px] px-1 py-0.5 rounded bg-surface">{{ n.scope_path }}</code>
            <code v-if="n.module_id" class="text-[10px] px-1 py-0.5 rounded bg-surface">{{ n.module_id }}</code>
            <code v-if="n.issue_hash" class="text-[10px] px-1 py-0.5 rounded bg-surface">{{ n.issue_hash.slice(0, 8) }}</code>
            <span class="ml-auto inline-flex gap-1">
              <BaseButton variant="icon-success" icon="mdiCheckCircleOutline" :icon-size="13" :tooltip="t('Resolve')" @click="onResolve(n)" />
              <BaseButton variant="icon-error"   icon="mdiDelete"             :icon-size="13" :tooltip="t('Delete')" @click="onDelete(n)" />
            </span>
          </div>
        </div>
      </section>

      <!-- Recent runs -->
      <section class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60">
          <h3 class="font-semibold text-sm">{{ t('Recent runs') }}</h3>
        </header>
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('When') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('User') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Kind') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Status') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Pages') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Errors') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Warnings') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in detailState.detail.runs" :key="r.id"
              @click="openRun(r.id)"
              class="border-t border-border/30 hover:bg-surface-soft-hover cursor-pointer"
            >
              <td class="px-4 py-2 text-[11px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(r.started_at) }}</td>
              <td class="px-4 py-2 text-[11px]">{{ userLabel(r) }}</td>
              <td class="px-4 py-2">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="r.kind === 'site-wide' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
                >{{ r.kind === 'site-wide' ? t('Site-wide') : t('Single') }}</span>
              </td>
              <td class="px-4 py-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded" :class="statusColor(r.status)">
                  {{ statusLabel(r.status) }}
                </span>
              </td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums">{{ r.pages_count }}</td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums" :class="r.total_errors > 0 && 'text-error'">{{ r.total_errors }}</td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums text-muted">{{ r.total_warnings }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Resolved notes (collapsed) -->
      <details v-if="resolvedNotes.length" class="bg-surface-soft border border-border rounded-xl">
        <summary class="px-4 py-3 cursor-pointer text-sm font-semibold">
          {{ t('Resolved notes ({n})', { n: resolvedNotes.length }) }}
        </summary>
        <div class="px-4 py-3 space-y-3">
          <div v-for="n in resolvedNotes" :key="n.id" class="opacity-60">
            <p class="text-sm whitespace-pre-wrap">{{ n.content }}</p>
            <div class="mt-1 flex items-center gap-2 text-[11px] text-muted">
              <span>{{ userLabel(n) }}</span>
              <span>·</span>
              <span>{{ t('resolved') }} {{ formatTime(n.resolved_at) }}</span>
              <span class="ml-auto">
                <BaseButton variant="icon" icon="mdiUndo" :icon-size="13" :tooltip="t('Unresolve')" @click="onUnresolve(n)" />
              </span>
            </div>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
