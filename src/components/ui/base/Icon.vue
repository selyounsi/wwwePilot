<script setup>
import { computed } from 'vue'
import { ICONS } from 'virtual:icons'

const props = defineProps({
  name:  { type: String, required: true },
  size:  { type: [Number, String], default: 16 },
  color: { type: String, default: 'currentColor' },
})

// computed so icons swap when a bound name changes (lock toggle, copy→check)
const path = computed(() => ICONS[props.name] ?? null)
</script>

<!-- icon catalogue: https://pictogrammers.com/library/mdi/ -->
<template>
  <svg
    v-if="path"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="color"
    aria-hidden="true"
    style="flex-shrink:0; display:inline-block; vertical-align:middle;"
  >
    <path :d="path" />
  </svg>
</template>
