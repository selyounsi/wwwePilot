<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
  placeholder:{ type: String, default: '' },
  type:       { type: String, default: 'text' },
  error:      { type: String, default: '' },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" class="text-xs text-muted">{{ label }}</label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
      :class="[
        'w-full bg-surface-soft border rounded-xl px-4 py-2.5 text-sm outline-none transition-all',
        'placeholder:text-muted/40',
        error
          ? 'border-error/40 focus:border-error'
          : 'border-border focus:border-primary/50',
      ]"
    />
    <p v-if="error" class="text-xs text-error">{{ error }}</p>
  </div>
</template>