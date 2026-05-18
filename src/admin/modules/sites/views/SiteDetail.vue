<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useToast }      from '@/composables/useToast.js'
import { useAdminSites } from '@/admin/modules/sites/composables/useAdminSites.js'
import { useSiteNotes }  from '@/composables/useSiteNotes.js'
import { usePermissions } from '@/composables/usePermissions.js'

const router = useRouter()
const route  = useRoute()
const { t } = useI18n()
const toast = useToast()
const { detailState, fetchDetail, purge, fetchConfig, saveConfig } = useAdminSites()
const { createNote, updateNote, deleteNote, ensureLoaded } = useSiteNotes()
const { canWriteUsers } = usePermissions()

const origin = computed(() => decodeURIComponent(String(route.params.origin ?? '')))

const adding   = ref(false)
const draft    = ref({ content: '', scopePath: '', moduleId: '' })

// Per-domain config — fetched separately so the rest of the page renders
// instantly while we resolve the config row (or get a stub back).
const config       = ref(null)
const configDraft  = ref({ defaultLanguage: '', notes: '', spellcheckSchedule: 'manual' })
const configEditing = ref(false)
const configBusy    = ref(false)

async function loadConfig() {
  if (!origin.value) return
  try {
    config.value = await fetchConfig(origin.value)
    configDraft.value = {
      defaultLanguage:    config.value?.defaultLanguage    ?? '',
      notes:              config.value?.notes              ?? '',
      spellcheckSchedule: config.value?.spellcheckSchedule ?? 'manual',
    }
  } catch { /* tolerated — UI shows defaults */ }
}

async function saveSiteConfig() {
  configBusy.value = true
  try {
    config.value = await saveConfig(origin.value, {
      defaultLanguage:    configDraft.value.defaultLanguage || null,
      notes:              configDraft.value.notes || null,
      spellcheckSchedule: configDraft.value.spellcheckSchedule,
    })
    configEditing.value = false
    toast.success(t('Site config saved'))
  } catch (e) { toast.error(e.message) }
  finally { configBusy.value = false }
}

async function load() {
  if (!origin.value) return
  await fetchDetail(origin.value)
  await ensureLoaded(origin.value, { force: true })
  loadConfig()
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

function openRun(r) {
  router.push({ name: 'admin-run-detail', params: { id: r.id } })
}

const runsColumns = [
  { key: 'when',     label: 'When',     minWidth: 150 },
  { key: 'user',     label: 'User',     minWidth: 140 },
  { key: 'kind',     label: 'Kind',     minWidth: 100 },
  { key: 'status',   label: 'Status',   minWidth: 110 },
  { key: 'pages',    label: 'Pages',    minWidth: 70, align: 'right' },
  { key: 'errors',   label: 'Errors',   minWidth: 70, align: 'right' },
  { key: 'warnings', label: 'Warnings', minWidth: 80, align: 'right' },
]

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
      <section v-if="detailState.detail.aggregate" class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile :label="t('Total runs')"     :value="detailState.detail.aggregate.run_count" />
        <KpiTile :label="t('Unique users')"   :value="detailState.detail.aggregate.unique_users" />
        <KpiTile :label="t('Errors (sum)')"   :value="detailState.detail.aggregate.error_total"   tone="error" />
        <KpiTile :label="t('Warnings (sum)')" :value="detailState.detail.aggregate.warning_total" />
      </section>

      <!-- Per-domain config -->
      <section class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 class="font-semibold text-sm">{{ t('Site config') }}</h3>
          <BaseButton
            v-if="canWriteUsers && !configEditing"
            variant="pill" icon="mdiPencil" :icon-size="13"
            @click="configEditing = true"
          >{{ t('Edit') }}</BaseButton>
          <div v-else-if="configEditing" class="flex gap-2">
            <BaseButton variant="pill" @click="configEditing = false; loadConfig()">{{ t('Cancel') }}</BaseButton>
            <BaseButton
              variant="pill"
              class="bg-primary! border-primary! text-black/80!"
              :disabled="configBusy"
              @click="saveSiteConfig"
            >{{ t('Save') }}</BaseButton>
          </div>
        </header>

        <div v-if="!configEditing" class="px-4 py-3 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Default language') }}</div>
            <div class="mt-1 font-mono">{{ config?.defaultLanguage ?? t('Auto-detect') }}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Spellcheck schedule') }}</div>
            <div class="mt-1">{{ t(config?.spellcheckSchedule ?? 'manual') }}</div>
          </div>
          <div class="col-span-3">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Admin notes') }}</div>
            <p v-if="config?.notes" class="mt-1 whitespace-pre-wrap">{{ config.notes }}</p>
            <p v-else class="mt-1 text-muted/60 italic">{{ t('No notes.') }}</p>
          </div>
        </div>

        <div v-else class="px-4 py-3 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField v-model="configDraft.defaultLanguage" dense full-width :label="t('Default language')">
              <option value="">{{ t('Auto-detect') }}</option>
              <option value="de-DE">de-DE</option>
              <option value="en-US">en-US</option>
              <option value="en-GB">en-GB</option>
            </SelectField>
            <SelectField v-model="configDraft.spellcheckSchedule" dense full-width :label="t('Spellcheck schedule')">
              <option value="manual">{{ t('manual') }}</option>
              <option value="daily">{{ t('daily') }}</option>
              <option value="weekly">{{ t('weekly') }}</option>
            </SelectField>
          </div>
          <TextareaField
            v-model="configDraft.notes"
            dense
            :rows="3"
            :label="t('Admin notes')"
            :placeholder="t('Free-form notes about this site…')"
          />
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

      <div>
        <h3 class="font-semibold text-sm mb-2">{{ t('Recent runs') }}</h3>
        <DataTable
          :rows="detailState.detail.runs ?? []"
          :columns="runsColumns"
          :on-row-click="openRun"
          :empty-text="t('No runs for this site yet.')"
          dense
          min-width="900px"
        >
          <template #cell-when="{ row }"><CellTimestamp :value="row.started_at" mode="both" /></template>
          <template #cell-user="{ row }"><CellUser :user="row" /></template>
          <template #cell-kind="{ row }">
            <CellBadge
              :value="row.kind"
              :label="row.kind === 'site-wide' ? t('Site-wide') : t('Single')"
              :class-name="row.kind === 'site-wide' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
            />
          </template>
          <template #cell-status="{ row }"><CellBadge variant="status" :value="row.status" /></template>
          <template #cell-pages="{ row }"><CellNumber :value="row.pages_count" /></template>
          <template #cell-errors="{ row }"><CellNumber :value="row.total_errors" error-when="> 0" /></template>
          <template #cell-warnings="{ row }"><CellNumber :value="row.total_warnings" muted-when=">= 0" /></template>
        </DataTable>
      </div>

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
