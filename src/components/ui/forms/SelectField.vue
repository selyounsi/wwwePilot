<script setup>
import { computed, useAttrs } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

defineOptions({ inheritAttrs: false })

const { t } = useI18n()

/**
 * Standardized <select> for the admin shell. Replaces 7+ raw
 * `<select class="bg-surface border ...">` instances.
 *
 *  <SelectField
 *    v-model="filterStatus"
 *    :options="[
 *      { value: '',         label: 'All statuses' },
 *      { value: 'open',     label: 'Open' },
 *      { value: 'resolved', label: 'Resolved' },
 *    ]"
 *  />
 *
 * Or use the default slot directly:
 *
 *  <SelectField v-model="days">
 *    <option :value="7">Last 7 days</option>
 *    <option :value="30">Last 30 days</option>
 *  </SelectField>
 */

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  label:      { type: String, default: '' },
  options:    { type: Array,  default: () => [] },
  density:    { type: String, default: 'default' },
  dense:      { type: Boolean, default: false },
  error:      { type: String, default: '' },
  helperText: { type: String, default: '' },
  disabled:   { type: Boolean, default: false },
  fullWidth:  { type: Boolean, default: false },
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

const selectClass = computed(() => [
  'bg-surface border rounded outline-none transition-colors cursor-pointer',
  densityClass.value,
  props.fullWidth && 'w-full',
  props.error
    ? 'border-error/40 focus:border-error'
    : 'border-border focus:border-primary/60',
  props.disabled && 'opacity-60 cursor-not-allowed',
])
</script>

<template>
  <div class="flex flex-col gap-1" :class="!fullWidth && 'inline-flex'">
    <label v-if="label" class="text-[10px] uppercase tracking-wide text-muted/70">{{ label }}</label>
    <select
      :value="modelValue"
      :disabled="disabled"
      v-bind="attrs"
      :class="selectClass"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option
        v-for="opt in options"
        :key="`${opt.value}`"
        :value="opt.value"
        :disabled="opt.disabled"
      >{{ opt.translate === false ? opt.label : t(opt.label) }}</option>
      <slot />
    </select>
    <p v-if="error" class="text-[10px] text-error">{{ error }}</p>
    <p v-else-if="helperText" class="text-[10px] text-muted/60">{{ helperText }}</p>
  </div>
</template>
