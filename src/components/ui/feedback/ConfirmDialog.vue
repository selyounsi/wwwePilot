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
  <BaseModal :open="open" :title="title" size="sm" @update:open="$emit('update:open', $event)" @close="emit('cancel')">
    <p v-if="message" class="text-xs text-muted leading-relaxed">{{ message }}</p>

    <TextareaField
      v-if="withNote"
      ref="inputRef"
      v-model="note"
      :placeholder="notePlaceholder || t('Optional note (why?)')"
      dense
      auto-grow
      :rows="2"
      max-height="120px"
      class="mt-3"
      @keydown.enter.meta.prevent="confirm"
      @keydown.enter.ctrl.prevent="confirm"
    />

    <template #footer>
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
    </template>
  </BaseModal>
</template>
