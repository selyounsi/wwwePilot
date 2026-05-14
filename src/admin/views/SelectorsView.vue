<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n }            from '@/composables/i18n/useI18n.js'
import { useToast }           from '@/composables/useToast.js'
import { useAdminSelectors }  from '@/admin/composables/useAdminSelectors.js'

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
      <nav class="flex gap-1 mb-4 border-b border-border">
        <button
          v-for="scope in state.scopes" :key="scope"
          @click="activeScope = scope"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="activeScope === scope
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-light'"
        >
          {{ scope }}
          <span class="ml-1 text-[10px] text-muted/60 tabular-nums">
            {{ (grouped.get(scope) ?? []).length }}
          </span>
        </button>
      </nav>

      <section class="bg-surface-soft border border-primary/30 rounded-xl p-4 mb-4">
        <h3 class="text-sm font-semibold mb-2">{{ t('Add new selector to scope "{s}"', { s: activeScope }) }}</h3>
        <div class="flex gap-2">
          <input
            v-model="newPattern"
            :placeholder="t('e.g. .cookie-banner, #widget, [data-tracker]')"
            class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/60"
            @keydown.enter="onCreate"
          />
          <input
            v-model="newNote"
            :placeholder="t('Optional note')"
            class="w-64 bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary/60"
            @keydown.enter="onCreate"
          />
          <BaseButton class="text-xs! py-1.5!" @click="onCreate">
            <Icon name="mdiPlus" :size="13" />
            {{ t('Add') }}
          </BaseButton>
        </div>
      </section>

      <section class="bg-surface-soft border border-border rounded-xl">
        <div class="px-4 py-2.5 border-b border-border/60 flex items-center gap-3 text-[11px] text-muted">
          <span>{{ t('{n} total', { n: activeCounts.total }) }}</span>
          <span class="text-success">{{ t('{n} active', { n: activeCounts.active }) }}</span>
          <span v-if="activeCounts.disabled" class="text-error">{{ t('{n} disabled', { n: activeCounts.disabled }) }}</span>
          <span class="ml-auto">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary mr-1">{{ activeCounts.seed }} {{ t('seed') }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light">{{ activeCounts.custom }} {{ t('custom') }}</span>
          </span>
        </div>

        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('Pattern') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Note') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Source') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Status') }}</th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sel in activeList" :key="sel.id"
              class="border-t border-border/40 hover:bg-surface-soft-hover"
              :class="sel.disabled && 'opacity-60'"
            >
              <td class="px-4 py-2"><code class="text-[11px] text-light">{{ sel.pattern }}</code></td>
              <td class="px-4 py-2">
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
              </td>
              <td class="px-4 py-2">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="sel.source === 'seed'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-surface text-light'"
                >{{ sel.source }}</span>
              </td>
              <td class="px-4 py-2">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="sel.disabled
                    ? 'bg-error/15 text-error'
                    : 'bg-success/15 text-success'"
                >{{ sel.disabled ? t('disabled') : t('active') }}</span>
              </td>
              <td class="px-4 py-2 text-right whitespace-nowrap">
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
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!activeList.length" class="text-center text-muted py-8 text-sm">
          {{ t('No selectors in this scope yet.') }}
        </p>
      </section>
    </div>
  </div>
</template>
