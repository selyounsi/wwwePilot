<script setup>
import { computed } from 'vue'

/**
 * Render an origin / URL compactly. `short=true` strips the protocol and
 * trailing slash so a table column stays readable; the full origin is in
 * the title attribute.
 */

const props = defineProps({
  value: { type: String, default: '' },
  short: { type: Boolean, default: true },
  mono:  { type: Boolean, default: false },
})

const display = computed(() => {
  if (!props.value) return ''
  if (!props.short) return props.value
  try {
    const u = new URL(props.value)
    return u.host + (u.pathname && u.pathname !== '/' ? u.pathname : '')
  } catch {
    return props.value.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
})
</script>

<template>
  <span class="truncate" :class="mono && 'font-mono text-[11px]'" :title="value">{{ display }}</span>
</template>
