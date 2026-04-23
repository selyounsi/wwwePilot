<script setup>
defineProps({
  count:        { type: Number, default: null },
  warningCount: { type: Number, default: null },
})
</script>

<template>
  <span v-if="count !== null"
    :class="[
      'text-xs font-mono font-bold px-2 py-0.5 rounded-lg',
      count > 0
        ? 'bg-error-soft'
        : warningCount > 0
          ? 'bg-alert-soft'
          : 'bg-success-soft',
    ]">
    {{ count > 0 ? `${count} Fehler` : warningCount > 0 ? `${warningCount} Warnungen` : '✓ OK' }}
  </span>
</template>