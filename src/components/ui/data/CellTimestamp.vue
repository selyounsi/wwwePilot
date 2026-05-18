<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { relativeTime } from '@/admin/composables/timelineFormat.js'

const { t } = useI18n()

/**
 * Render a date/time consistently across admin tables.
 *
 *  mode="relative" → "5 min ago"
 *  mode="absolute" → "15.5.2026, 08:45:00"
 *  mode="both"     → "15.5.2026, 08:45:00" with tooltip "5 min ago" (or vice versa)
 *  mode="date"     → date only, no time
 *
 * Empty / null values render as the muted em-dash.
 */

const props = defineProps({
  value: { type: [String, Number, Date], default: null },
  mode:  { type: String, default: 'absolute' },
})

function asDate() {
  if (!props.value) return null
  const d = props.value instanceof Date ? props.value : new Date(props.value)
  return Number.isNaN(d.getTime()) ? null : d
}

const date = computed(asDate)

const absolute = computed(() => date.value ? date.value.toLocaleString() : '')
const dateOnly = computed(() => date.value ? date.value.toLocaleDateString() : '')
const relative = computed(() => date.value ? relativeTime(date.value.toISOString(), t) : '')

const display = computed(() => {
  if (!date.value) return null
  switch (props.mode) {
    case 'relative': return relative.value
    case 'date':     return dateOnly.value
    case 'both':     return absolute.value
    default:         return absolute.value
  }
})

const title = computed(() => {
  if (!date.value) return null
  if (props.mode === 'relative') return absolute.value
  if (props.mode === 'both')     return relative.value
  return null
})
</script>

<template>
  <span v-if="display" class="text-muted tabular-nums whitespace-nowrap" :title="title">{{ display }}</span>
  <span v-else class="text-muted/40">—</span>
</template>
