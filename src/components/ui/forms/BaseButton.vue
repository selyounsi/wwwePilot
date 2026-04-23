<script setup>
defineProps({
  variant:  { type: String, default: 'primary' }, // 'primary' | 'secondary' | 'ghost'
  loading:  { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <button
    v-bind="$attrs"
    :disabled="disabled || loading"
    :class="[
      'w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]',
      (disabled || loading)
        ? 'bg-surface-soft text-muted cursor-not-allowed'
        : variant === 'secondary'
          ? 'bg-secondary'
          : variant === 'ghost'
            ? 'bg-surface-soft hover:bg-surface-soft-hover text-muted'
            : 'bg-primary',
    ]"
  >
    <span v-if="loading" class="flex items-center justify-center gap-2">
      <span class="w-4 h-4 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
      <slot name="loading">Wird geladen…</slot>
    </span>
    <slot v-else />
  </button>
</template>