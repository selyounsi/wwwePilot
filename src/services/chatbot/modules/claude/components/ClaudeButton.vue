<script setup>
import { useClaude } from '../composables/useClaude.js'
import { useI18n }   from '@/composables/i18n/useI18n.js'

defineProps({
  size:     { type: Number,  default: 13 },
  iconOnly: { type: Boolean, default: false },
  loading:  { type: Boolean, default: false },
  label:    { type: String,  default: '' },
  variant:  { type: String,  default: 'subtle' },
})

defineEmits(['click'])

const { isAvailable } = useClaude()
const { t }           = useI18n()
</script>

<template>
  <button
    v-if="isAvailable"
    @click.stop="$emit('click', $event)"
    :disabled="loading"
    :title="label || t('Ask Claude')"
    class="inline-flex items-center gap-1.5 transition-all rounded-md disabled:opacity-50"
    :class="[
      variant === 'pill'
        ? 'px-2 py-1 bg-surface-soft border border-border hover:bg-surface-soft-hover text-light text-[11px]'
        : 'p-0.5 text-muted/40 hover:text-primary hover:bg-primary/10 hover:scale-110',
    ]"
  >
    <span
      v-if="loading"
      class="w-3 h-3 border-2 border-muted/30 border-t-primary rounded-full animate-spin shrink-0"
    />
    <Icon v-else name="mdiAutoFix" :size="size" />
    <span v-if="!iconOnly && label" class="font-medium">{{ label }}</span>
  </button>
</template>
