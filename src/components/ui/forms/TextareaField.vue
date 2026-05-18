<script setup>
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

/**
 * Standardized <textarea> for the admin shell. Replaces 10 raw
 * `<textarea class="bg-surface border ... resize-y">` instances across
 * UserDetail, ReportDetail, SiteDetail, ReportDialog, SiteNotesBanner,
 * ConfirmDialog, etc.
 *
 *  <TextareaField v-model="note" label="Admin note" :rows="4" />
 *  <TextareaField v-model="note" auto-grow placeholder="…" />
 */

const props = defineProps({
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
  placeholder:{ type: String, default: '' },
  rows:       { type: Number, default: 3 },
  density:    { type: String, default: 'default' },
  dense:      { type: Boolean, default: false },
  error:      { type: String, default: '' },
  helperText: { type: String, default: '' },
  disabled:   { type: Boolean, default: false },
  autoGrow:   { type: Boolean, default: false },
  maxHeight:  { type: String, default: '' },
})

defineEmits(['update:modelValue'])
const attrs = useAttrs()

const resolved = computed(() => props.dense ? 'compact' : props.density)

const densityClass = computed(() => {
  switch (resolved.value) {
    case 'compact': return 'px-2 py-1.5 text-xs'
    case 'loose':   return 'px-4 py-3 text-base'
    default:        return 'px-3 py-2 text-sm'
  }
})

const inputClass = computed(() => [
  'block w-full bg-surface border rounded outline-none transition-colors',
  'placeholder:text-muted/40 leading-snug',
  props.autoGrow ? 'resize-none' : 'resize-y',
  densityClass.value,
  props.error
    ? 'border-error/40 focus:border-error'
    : 'border-border focus:border-primary/60',
  props.disabled && 'opacity-60 cursor-not-allowed',
])

const inputStyle = computed(() => {
  if (!props.autoGrow) return null
  // `field-sizing: content` is the modern CSS way to auto-grow.
  const s = { fieldSizing: 'content' }
  if (props.maxHeight) s.maxHeight = props.maxHeight
  return s
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" class="text-[10px] uppercase tracking-wide text-muted/70">{{ label }}</label>
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :rows="autoGrow ? 1 : rows"
      :disabled="disabled"
      v-bind="attrs"
      :class="inputClass"
      :style="inputStyle"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="error" class="text-[10px] text-error">{{ error }}</p>
    <p v-else-if="helperText" class="text-[10px] text-muted/60">{{ helperText }}</p>
  </div>
</template>
