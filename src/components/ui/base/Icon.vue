<script setup>
import * as mdi from '@mdi/js'

const props = defineProps({
  name:  { type: String, required: true }, // z.B. "mdiRobot"
  size:  { type: [Number, String], default: 16 },
  color: { type: String, default: 'currentColor' },
})

const path = mdi[props.name] ?? null
</script>

<!--
  Verwendung (name = camelCase MDI Icon-Name):
    <Icon name="mdiRobot" />
    <Icon name="mdiArrowLeft" :size="20" />

  Alle Icons: https://pictogrammers.com/library/mdi/
-->
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