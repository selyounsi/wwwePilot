<script setup>
import { computed } from 'vue'

/**
 * Single source for checkboxes. Replaces 8 raw `<input type="checkbox"
 * class="accent-primary">` instances across forms and inline toggles.
 *
 *  <CheckboxField v-model="enabled" label="Enable feature" />
 *  <CheckboxField v-model="forceAdd" label="Force" description="Skip LT validation" />
 *  <CheckboxField v-model="forceAdd" label="Force" :info-tooltip="t('Long explanation…')" />
 */

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  label:       { type: String, default: '' },
  description: { type: String, default: '' },
  infoTooltip: { type: String, default: '' },
  disabled:    { type: Boolean, default: false },
  size:        { type: String, default: 'sm' },
})

defineEmits(['update:modelValue'])

const labelClass = computed(() =>
  props.size === 'sm' ? 'text-[10px]' : 'text-xs',
)
</script>

<template>
  <label
    class="inline-flex items-start gap-2 cursor-pointer"
    :class="disabled && 'opacity-60 cursor-not-allowed'"
  >
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="accent-primary mt-0.5 shrink-0"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="min-w-0">
      <span v-if="label" class="text-muted inline-flex items-center gap-1" :class="labelClass">
        {{ label }}
        <InfoHint v-if="infoTooltip" :text="infoTooltip" />
      </span>
      <span v-if="description" class="text-muted/60 text-[10px] block">{{ description }}</span>
    </span>
  </label>
</template>
