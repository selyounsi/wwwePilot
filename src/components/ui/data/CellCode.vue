<script setup>
import { computed } from 'vue'

/**
 * Inline monospace for IDs / hashes / selectors / module slugs. Optional
 * slice for shortening long UUIDs without dropping the full value from the
 * title attribute (so admins can still copy it via DOM if they need to).
 */

const props = defineProps({
  value:   { type: [String, Number], default: '' },
  slice:   { type: Number, default: 0 },
})

const display = computed(() => {
  const v = String(props.value ?? '')
  return props.slice > 0 ? v.slice(0, props.slice) : v
})
</script>

<template>
  <code class="font-mono text-[11px] text-muted" :title="String(value ?? '')">{{ display }}</code>
</template>
