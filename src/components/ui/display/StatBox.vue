<script setup>
defineProps({
  label:   { type: String, required: true },
  variant: { type: String, default: 'neutral' },
})
</script>

<template>
  <div
    class="rounded-xl p-3 text-center border"
    :class="{
      'bg-surface-soft border-border'     : variant === 'neutral',
      'bg-success-soft border-success/30' : variant === 'success',
      'bg-transparent  border-border/40'  : variant === 'muted',
    }"
  >
    <p class="text-xs text-muted">{{ label }}</p>
    <p class="text-lg font-bold mt-0.5"><slot /></p>
  </div>
</template>