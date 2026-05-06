<script setup>
import { ref, watch, nextTick } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

const props = defineProps({
  open:            { type: Boolean, required: true },
  title:           { type: String,  default: '' },
  message:         { type: String,  default: '' },
  confirmText:     { type: String,  default: '' },
  cancelText:      { type: String,  default: '' },
  variant:         { type: String,  default: 'primary' },
  withNote:        { type: Boolean, default: false },
  notePlaceholder: { type: String,  default: '' },
  initialNote:     { type: String,  default: '' },
})

const emit = defineEmits(['update:open', 'confirm', 'cancel'])
const { t }    = useI18n()
const note     = ref('')
const inputRef = ref(null)

watch(() => props.open, (v) => {
  if (v) {
    note.value = props.initialNote || ''
    if (props.withNote) nextTick(() => inputRef.value?.focus())
  }
})

function close() {
  emit('cancel')
  emit('update:open', false)
}

function confirm() {
  emit('confirm', note.value.trim())
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cd-fade">
      <div v-if="open" class="fixed inset-0 bg-black/60 z-50" @click="close" />
    </Transition>
    <Transition name="cd-pop">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          class="bg-background border border-border rounded-2xl w-full max-w-sm shadow-2xl pointer-events-auto flex flex-col gap-3 p-4"
          @click.stop
        >
          <div v-if="title" class="text-sm font-semibold text-light">{{ title }}</div>
          <p v-if="message" class="text-xs text-muted leading-relaxed">{{ message }}</p>

          <textarea
            v-if="withNote"
            ref="inputRef"
            v-model="note"
            :placeholder="notePlaceholder || t('Optional note (why?)')"
            class="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-light outline-none focus:border-primary/60 placeholder:text-muted/50 resize-none leading-snug"
            rows="2"
            style="field-sizing: content; max-height: 120px"
            @keydown.enter.meta.prevent="confirm"
            @keydown.enter.ctrl.prevent="confirm"
          />

          <div class="flex gap-2 mt-1">
            <BaseButton variant="ghost" class="flex-1 py-2! text-xs!" @click="close">
              {{ cancelText || t('Cancel') }}
            </BaseButton>
            <BaseButton
              :class="[
                'flex-1 py-2! text-xs!',
                variant === 'danger' ? 'bg-error! hover:opacity-90' : '',
              ]"
              @click="confirm"
            >
              {{ confirmText || t('Confirm') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cd-fade-enter-active, .cd-fade-leave-active { transition: opacity .18s ease; }
.cd-fade-enter-from, .cd-fade-leave-to       { opacity: 0; }
.cd-pop-enter-active, .cd-pop-leave-active   { transition: transform .2s cubic-bezier(.32,.72,0,1), opacity .18s ease; }
.cd-pop-enter-from, .cd-pop-leave-to         { transform: scale(.96); opacity: 0; }
</style>
