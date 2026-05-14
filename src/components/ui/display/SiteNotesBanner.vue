<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n }      from '@/composables/i18n/useI18n.js'
import { useToast }     from '@/composables/useToast.js'
import { useSiteNotes } from '@/composables/useSiteNotes.js'

const props = defineProps({
  origin:    { type: String, required: true },
  scopePath: { type: String, default: null },
  moduleId:  { type: String, default: null },
})

const { t } = useI18n()
const toast = useToast()
const { ensureLoaded, createNote, updateNote, deleteNote, activeFor } = useSiteNotes()

const expanded = ref(false)
const draft    = ref('')
const adding   = ref(false)

const relevant = computed(() => activeFor({
  origin:    props.origin,
  scopePath: props.scopePath,
  moduleId:  props.moduleId,
  // banner ist domain/path/module-scoped — issue-level notes haben ihr eigenes UI in den Items
  issueHash: null,
}).filter(n => !n.issueHash))

async function refresh() {
  if (!props.origin) return
  await ensureLoaded(props.origin)
}

onMounted(refresh)
watch(() => props.origin, refresh)

async function onAdd() {
  if (!draft.value.trim()) return
  try {
    await createNote({
      origin:    props.origin,
      scopePath: props.scopePath,
      moduleId:  props.moduleId,
      content:   draft.value.trim(),
    })
    draft.value  = ''
    adding.value = false
    toast.success(t('Note saved'))
  } catch (e) { toast.error(e.message) }
}

async function onResolve(note) {
  try { await updateNote(note.id, { resolve: true }) }
  catch (e) { toast.error(e.message) }
}

async function onUnresolve(note) {
  try { await updateNote(note.id, { resolve: false }) }
  catch (e) { toast.error(e.message) }
}

async function onDelete(note) {
  if (!confirm(t('Delete this note?'))) return
  try { await deleteNote(note.id, props.origin) }
  catch (e) { toast.error(e.message) }
}

function relative(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return t('just now')
  if (min < 60) return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)   return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

function authorName(n) {
  return n.firstName && n.lastName ? `${n.firstName} ${n.lastName}` : (n.email || '?')
}
</script>

<template>
  <div v-if="relevant.length || adding" class="bg-primary/5 border border-primary/30 rounded-xl mb-3 overflow-hidden">
    <button
      v-if="relevant.length"
      @click="expanded = !expanded"
      class="w-full px-3 py-2 flex items-center gap-2 hover:bg-primary/10 transition-colors text-left"
    >
      <Icon name="mdiNoteOutline" :size="14" class="text-primary" />
      <span class="text-xs font-semibold text-primary">
        {{ t('{n} active note(s) for this site', { n: relevant.length }) }}
      </span>
      <Icon :name="expanded ? 'mdiChevronUp' : 'mdiChevronDown'" :size="14" class="text-primary ml-auto" />
    </button>

    <div v-if="expanded || adding" class="px-3 py-2 border-t border-primary/20 space-y-2">
      <div
        v-for="n in relevant" :key="n.id"
        class="bg-surface-soft border border-border rounded-lg p-2 text-xs"
      >
        <p class="text-light whitespace-pre-wrap">{{ n.content }}</p>
        <div class="mt-1.5 flex items-center gap-2 text-[10px] text-muted">
          <span>{{ authorName(n) }}</span>
          <span>·</span>
          <span>{{ relative(n.createdAt) }}</span>
          <span v-if="n.moduleId" class="ml-2">
            <code class="text-[10px] px-1 py-0.5 rounded bg-surface">{{ n.moduleId }}</code>
          </span>
          <span v-if="n.scopePath" class="ml-1">
            <code class="text-[10px] px-1 py-0.5 rounded bg-surface">{{ n.scopePath }}</code>
          </span>
          <span class="ml-auto inline-flex gap-1">
            <BaseButton variant="icon-success" icon="mdiCheckCircleOutline" :icon-size="12" :tooltip="t('Resolve')" @click="onResolve(n)" />
            <BaseButton variant="icon-error"   icon="mdiDelete"             :icon-size="12" :tooltip="t('Delete')"  @click="onDelete(n)" />
          </span>
        </div>
      </div>

      <div v-if="adding" class="bg-surface-soft border border-primary/40 rounded-lg p-2">
        <textarea
          v-model="draft"
          rows="2"
          :placeholder="t('Add a note for this site…')"
          class="w-full bg-surface border border-border rounded px-2 py-1 text-xs resize-y focus:outline-none focus:border-primary/60"
        />
        <div class="mt-1.5 flex justify-end gap-1">
          <BaseButton variant="ghost" class="text-xs! py-1!" @click="adding = false; draft = ''">{{ t('Cancel') }}</BaseButton>
          <BaseButton class="text-xs! py-1!" @click="onAdd">{{ t('Add note') }}</BaseButton>
        </div>
      </div>
      <button
        v-else
        @click="adding = true; expanded = true"
        class="text-[11px] text-primary hover:underline"
      >
        + {{ t('Add note') }}
      </button>
    </div>
  </div>

  <!-- collapsed state shows a single "+ note" button when no notes exist yet -->
  <button
    v-else
    @click="adding = true"
    class="text-[11px] text-muted hover:text-primary mb-3 inline-flex items-center gap-1"
  >
    <Icon name="mdiNotePlusOutline" :size="12" />
    {{ t('Add a note for this site') }}
  </button>
</template>
