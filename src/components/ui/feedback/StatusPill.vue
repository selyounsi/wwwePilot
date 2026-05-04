<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'

const { t } = useI18n()

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
    {{ count > 0
      ? t('{n} errors',   { n: count })
      : warningCount > 0
        ? t('{n} warnings', { n: warningCount })
        : '✓ OK' }}
  </span>
</template>