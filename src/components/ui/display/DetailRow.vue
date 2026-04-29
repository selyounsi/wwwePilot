<script setup>
defineProps({
  label: { type: String,  required: true },
  width: { type: String,  default: 'w-20' },
  mono:  { type: Boolean, default: false },
})
</script>

<template>
  <div class="flex gap-3 items-start">
    <span :class="['text-xs text-muted/60 shrink-0', width, mono ? 'font-mono' : '']">{{ label }}</span>
    <div class="text-xs text-light min-w-0 break-all flex-1">
      <slot />
    </div>
  </div>
</template>
