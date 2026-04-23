<script setup>
defineProps({
  color: { type: String, default: 'warning' }, // 'warning' | 'muted'
  size:  { type: String, default: 'md' },      // 'sm' | 'md'
})
const sizes  = { sm: 'w-4 h-4', md: 'w-6 h-6' }
const colors = {
  warning: 'border-warning/30 border-t-warning',
  muted:   'border-muted/30   border-t-muted',
}
</script>

<template>
  <div :class="['border-2 rounded-full animate-spin', sizes[size], colors[color]]" />
</template>