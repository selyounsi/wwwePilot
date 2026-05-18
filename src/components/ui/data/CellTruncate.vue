<script setup>
/**
 * Single-line truncation with a tooltip showing the full text. The parent
 * column should set a `width` / `maxWidth` for this to do anything — the
 * component just applies the `truncate` rule and tooltip wiring.
 */
defineProps({
  value: { type: [String, Number], default: '' },
})
</script>

<template>
  <span class="block truncate" :title="String(value ?? '')">{{ value }}</span>
</template>
