<script setup>
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

/**
 * The canonical text-input for the admin shell. Replaces ~25 raw
 * `<input class="bg-surface border border-border rounded ...">` instances
 * across forms, filter bars and inline editors.
 *
 *  <FormField v-model="email" type="email" label="Email" />
 *  <FormField v-model="q" placeholder="Search…" prefix-icon="mdiMagnify" />
 *  <FormField v-model="value" :error="errors.value" helper-text="Must be at least 8 chars" />
 *
 * Three densities — `compact` (text-xs, py-1.5 — admin filters & tables),
 * `default` (text-sm, py-2.5 — forms), `loose` (text-base — auth screens).
 * Default density picked from the prop, falling back to `default`. Pass
 * `:dense="true"` as a shortcut for `density="compact"`.
 */

const props = defineProps({
  modelValue:  { type: [String, Number], default: '' },
  label:       { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type:        { type: String, default: 'text' },
  density:     { type: String, default: 'default' },
  dense:       { type: Boolean, default: false },
  prefixIcon:  { type: String, default: '' },
  suffixIcon:  { type: String, default: '' },
  error:       { type: String, default: '' },
  helperText:  { type: String, default: '' },
  disabled:    { type: Boolean, default: false },
  mono:        { type: Boolean, default: false },
  fullWidth:   { type: Boolean, default: true },
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
  'block bg-surface border rounded outline-none transition-colors',
  'placeholder:text-muted/40',
  densityClass.value,
  props.fullWidth && 'w-full',
  props.mono && 'font-mono',
  props.prefixIcon && (resolved.value === 'compact' ? 'pl-7' : 'pl-9'),
  props.suffixIcon && (resolved.value === 'compact' ? 'pr-7' : 'pr-9'),
  props.error
    ? 'border-error/40 focus:border-error'
    : 'border-border focus:border-primary/60',
  props.disabled && 'opacity-60 cursor-not-allowed',
])

const iconSize = computed(() => resolved.value === 'compact' ? 12 : 14)
</script>

<template>
  <div class="flex flex-col gap-1" :class="!fullWidth && 'inline-flex'">
    <label v-if="label" class="text-[10px] uppercase tracking-wide text-muted/70">{{ label }}</label>
    <div class="relative" :class="!fullWidth && 'inline-block'">
      <Icon
        v-if="prefixIcon"
        :name="prefixIcon"
        :size="iconSize"
        class="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        :class="resolved === 'compact' ? 'left-2' : 'left-3'"
      />
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        v-bind="attrs"
        :class="inputClass"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <Icon
        v-if="suffixIcon"
        :name="suffixIcon"
        :size="iconSize"
        class="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        :class="resolved === 'compact' ? 'right-2' : 'right-3'"
      />
    </div>
    <p v-if="error" class="text-[10px] text-error">{{ error }}</p>
    <p v-else-if="helperText" class="text-[10px] text-muted/60">{{ helperText }}</p>
  </div>
</template>
