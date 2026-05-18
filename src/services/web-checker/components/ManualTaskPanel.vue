<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { useCheckTypes } from '@/services/web-checker/composables/useCheckTypes.js'

const props = defineProps({
  url:    { type: String, default: '' },
  origin: { type: String, default: '' },
})

const { t }   = useI18n()
const toast   = useToast()
const { state, saveTaskState, fetchStatesForUrl } = useCheckTypes()

// Whenever the URL or the active type changes, re-pull the persisted
// states so the auditor sees their previous ticks/comments.
watch(() => [props.url, state.active?.type?.id], () => {
  if (props.url && state.active) fetchStatesForUrl(props.url)
}, { immediate: true })

const tasks = computed(() => state.active?.tasks ?? [])

function isChecked(task) {
  return state.states[task.id]?.checked ?? false
}
function commentOf(task) {
  return state.states[task.id]?.comment ?? ''
}

const checkedCount = computed(() => tasks.value.filter(t => isChecked(t)).length)

const expandedTaskId = ref(null)
function toggleExpand(taskId) {
  expandedTaskId.value = expandedTaskId.value === taskId ? null : taskId
}

const savingTaskId = ref(null)

async function persist(task, patch) {
  if (!props.url) return
  savingTaskId.value = task.id
  try {
    await saveTaskState(task.id, {
      origin:  props.origin,
      url:     props.url,
      checked: patch.checked ?? isChecked(task),
      comment: patch.comment ?? commentOf(task),
    })
  } catch (e) {
    toast.error(t('Task could not be saved: {msg}', { msg: e.message }))
  } finally {
    savingTaskId.value = null
  }
}

async function onToggle(task) {
  await persist(task, { checked: !isChecked(task) })
}

const commentDrafts = ref({})

function startCommentEdit(task) {
  commentDrafts.value[task.id] = commentOf(task)
  expandedTaskId.value = task.id
}

async function saveComment(task) {
  await persist(task, { comment: commentDrafts.value[task.id] ?? '' })
  expandedTaskId.value = null
}
</script>

<template>
  <div v-if="state.active && tasks.length" class="mt-3 border border-border rounded-lg overflow-hidden">
    <header class="px-3 py-2 bg-surface-soft flex items-center gap-2">
      <Icon name="mdiClipboardCheckOutline" :size="14" class="text-primary" />
      <h3 class="text-xs font-semibold flex-1 min-w-0 truncate">
        {{ t('Manual checklist') }}
      </h3>
      <span class="text-[10px] text-muted tabular-nums">{{ checkedCount }}/{{ tasks.length }}</span>
    </header>

    <ul class="divide-y divide-border/30">
      <li v-for="task in tasks" :key="task.id" class="px-3 py-2">
        <div class="flex items-start gap-2">
          <input
            type="checkbox"
            :checked="isChecked(task)"
            class="accent-primary mt-1 shrink-0"
            :disabled="savingTaskId === task.id || !url"
            @change="onToggle(task)"
          />
          <div class="flex-1 min-w-0">
            <div class="text-xs" :class="isChecked(task) && 'line-through text-muted'">{{ task.label }}</div>
            <div v-if="task.description" class="text-[10px] text-muted/70 mt-0.5">{{ task.description }}</div>
            <div v-if="commentOf(task) && expandedTaskId !== task.id" class="text-[10px] mt-1 italic text-muted">
              „{{ commentOf(task) }}"
            </div>
          </div>
          <BaseButton
            variant="icon"
            :icon="expandedTaskId === task.id ? 'mdiChevronUp' : 'mdiCommentTextOutline'"
            :icon-size="13"
            :class="commentOf(task) && 'text-primary'"
            :tooltip="commentOf(task) ? t('Edit comment') : t('Add comment')"
            @click="expandedTaskId === task.id ? expandedTaskId = null : startCommentEdit(task)"
          />
        </div>
        <div v-if="expandedTaskId === task.id" class="mt-2 ml-6">
          <TextareaField
            v-model="commentDrafts[task.id]"
            dense
            :rows="2"
            :placeholder="t('Optional comment (visible to admins reviewing the run)…')"
          />
          <div class="mt-1 flex justify-end gap-1">
            <BaseButton variant="ghost" class="text-xs! py-1!" @click="expandedTaskId = null">{{ t('Cancel') }}</BaseButton>
            <BaseButton
              variant="pill"
              class="bg-primary! border-primary! text-black/80!"
              :loading="savingTaskId === task.id"
              @click="saveComment(task)"
            >{{ t('Save') }}</BaseButton>
          </div>
        </div>
      </li>
    </ul>
    <p v-if="!url" class="px-3 py-2 text-[10px] text-muted/60 italic border-t border-border/30">
      {{ t('Run a check first — task states are saved per URL.') }}
    </p>
  </div>
</template>
