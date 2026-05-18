<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n }            from '@/composables/i18n/useI18n.js'
import { useToast }           from '@/composables/useToast.js'
import { useAdminSelectors } from '@/admin/modules/selectors/composables/useAdminSelectors.js'

const { t } = useI18n()
const toast = useToast()
const { state, fetchAll, create, update, remove, resetScope } = useAdminSelectors()

const activeScope = ref('global')
const newPattern  = ref('')
const newNote     = ref('')

onMounted(fetchAll)

const grouped = computed(() => {
  const m = new Map()
  for (const sel of state.selectors) {
    if (!m.has(sel.scope)) m.set(sel.scope, [])
    m.get(sel.scope).push(sel)
  }
  return m
})

const activeList = computed(() => grouped.value.get(activeScope.value) ?? [])
const activeCounts = computed(() => {
  const list = activeList.value
  return {
    total:    list.length,
    active:   list.filter(s => !s.disabled).length,
    disabled: list.filter(s =>  s.disabled).length,
    seed:     list.filter(s => s.source === 'seed').length,
    custom:   list.filter(s => s.source === 'admin').length,
  }
})

async function onCreate() {
  if (!newPattern.value.trim()) return
  try {
    await create({
      scope:   activeScope.value,
      pattern: newPattern.value.trim(),
      note:    newNote.value.trim() || null,
    })
    newPattern.value = ''
    newNote.value    = ''
    toast.success(t('Selector added'))
  } catch (e) {
    if (e.status === 409) toast.error(t('Selector already exists for this scope.'))
    else                  toast.error(e.message)
  }
}

async function toggleDisabled(sel) {
  try {
    await update(sel.id, { disabled: !sel.disabled })
    toast.success(sel.disabled ? t('Selector enabled') : t('Selector disabled'))
  } catch (e) { toast.error(e.message) }
}

async function onUpdateNote(sel, newNoteValue) {
  try {
    await update(sel.id, { note: newNoteValue })
    toast.success(t('Note saved'))
  } catch (e) { toast.error(e.message) }
}

async function onDelete(sel) {
  const msg = sel.source === 'seed'
    ? t('Delete default selector "{p}"? "Re-seed defaults" can bring it back.', { p: sel.pattern })
    : t('Delete selector "{p}"?', { p: sel.pattern })
  if (!confirm(msg)) return
  try {
    await remove(sel.id)
    toast.success(t('Selector deleted'))
  } catch (e) { toast.error(e.message) }
}

async function onReset() {
  if (!confirm(t('Re-seed defaults for scope "{s}"? Disabled rows stay disabled.', { s: activeScope.value }))) return
  try {
    const r = await resetScope(activeScope.value)
    toast.success(t('Re-seeded {n} default(s)', { n: r.inserted }))
  } catch (e) { toast.error(e.message) }
}

const editingId   = ref(null)
const draftNote   = ref('')
function startEditNote(sel) {
  editingId.value = sel.id
  draftNote.value = sel.note ?? ''
}
async function saveNote(sel) {
  await onUpdateNote(sel, draftNote.value)
  editingId.value = null
}

const columns = [
  { key: 'pattern', label: 'Pattern', minWidth: 240, truncate: true, titleFrom: s => s.pattern },
  { key: 'note',    label: 'Note',    minWidth: 200 },
  { key: 'source',  label: 'Source',  minWidth: 90 },
  { key: 'status',  label: 'Status',  minWidth: 100 },
]
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">{{ t('Ignore selectors') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('CSS selectors that web-checker modules skip. Live-editable — no extension release needed.') }}
        </p>
      </div>
      <BaseButton variant="pill" icon="mdiRefresh" :icon-size="13" @click="onReset">
        {{ t('Re-seed defaults for this scope') }}
      </BaseButton>
    </header>

    <div v-if="state.loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4">
      <p class="text-sm text-error">{{ state.error }}</p>
    </div>

    <div v-else>
      <TabNav
        v-model="activeScope"
        :tabs="state.scopes.map(scope => ({
          key: scope,
          label: scope,
          translate: false,
          count: (grouped.get(scope) ?? []).length,
        }))"
      />

      <BaseCard tone="primary" class="mb-4" :title="t('Add new selector to scope &quot;{s}&quot;', { s: activeScope })">
        <div class="flex flex-wrap gap-2">
          <FormField
            v-model="newPattern"
            mono
            class="flex-1 min-w-50"
            :placeholder="t('e.g. .cookie-banner, #widget, [data-tracker]')"
            @keydown.enter="onCreate"
          />
          <FormField
            v-model="newNote"
            class="w-64"
            :full-width="false"
            :placeholder="t('Optional note')"
            @keydown.enter="onCreate"
          />
          <BaseButton class="text-xs! py-1.5!" @click="onCreate">
            <Icon name="mdiPlus" :size="13" />
            {{ t('Add') }}
          </BaseButton>
        </div>
      </BaseCard>

      <DataTable
        :rows="activeList"
        :columns="columns"
        :empty-text="t('No selectors in this scope yet.')"
        min-width="780px"
      >
        <template #toolbar>
          <span>{{ t('{n} total', { n: activeCounts.total }) }}</span>
          <span class="text-success">{{ t('{n} active', { n: activeCounts.active }) }}</span>
          <span v-if="activeCounts.disabled" class="text-error">{{ t('{n} disabled', { n: activeCounts.disabled }) }}</span>
          <span class="ml-auto inline-flex gap-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">{{ activeCounts.seed }} {{ t('seed') }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light">{{ activeCounts.custom }} {{ t('custom') }}</span>
          </span>
        </template>

        <template #cell-pattern="{ row: sel }">
          <code class="text-[11px] text-light" :class="sel.disabled && 'opacity-60'">{{ sel.pattern }}</code>
        </template>

        <template #cell-note="{ row: sel }">
          <template v-if="editingId === sel.id">
            <input
              v-model="draftNote"
              class="bg-surface border border-border rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-primary/60"
              @blur="saveNote(sel)"
              @keydown.enter="saveNote(sel)"
            />
          </template>
          <template v-else>
            <button
              @click="startEditNote(sel)"
              class="text-[11px] text-muted hover:text-light text-left"
            >
              {{ sel.note || `(${t('add note')})` }}
            </button>
          </template>
        </template>

        <template #cell-source="{ row: sel }">
          <CellBadge
            :value="sel.source"
            :class-name="sel.source === 'seed' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
          />
        </template>

        <template #cell-status="{ row: sel }">
          <CellBadge
            :value="sel.disabled ? 'disabled' : 'active'"
            :class-name="sel.disabled ? 'bg-error/15 text-error' : 'bg-success/15 text-success'"
          />
        </template>

        <template #row-actions="{ row: sel }">
          <div class="inline-flex items-center gap-1">
            <BaseButton
              :variant="sel.disabled ? 'icon-success' : 'icon-alert'"
              :icon="sel.disabled ? 'mdiCheckCircleOutline' : 'mdiCancel'"
              :icon-size="16"
              :tooltip="sel.disabled ? t('Enable') : t('Disable')"
              @click="toggleDisabled(sel)"
            />
            <BaseButton
              variant="icon-error"
              icon="mdiDelete"
              :icon-size="16"
              :tooltip="t('Delete')"
              @click="onDelete(sel)"
            />
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>
