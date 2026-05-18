<script setup>
import { computed } from 'vue'

/**
 * The standard "big number tile" for admin dashboards. Replaces 23 raw
 * `text-2xl font-bold tabular-nums` instances across reports, dashboard,
 * health, system, sites/SiteDetail, users/UserDetail.
 *
 *  <KpiTile label="Open reports" :value="42" sublabel="last 7 days" />
 *  <KpiTile label="Errors" :value="100" tone="error" />
 *  <KpiTile label="Reports" :value="3" clickable @click="goto" tone="primary" />
 *
 * `tone` colors the value text — `error` for failure-counts,
 * `success` for resolutions, `primary` for CTAs. `clickable` makes the
 * whole tile feel pressable and adds hover/border-emphasis.
 */

const props = defineProps({
  label:     { type: String, required: true },
  value:     { type: [String, Number], default: '—' },
  sublabel:  { type: String, default: '' },
  icon:      { type: String, default: '' },
  tone:      { type: String, default: 'default' },
  clickable: { type: Boolean, default: false },
  active:    { type: Boolean, default: false },
})

const valueClass = computed(() => {
  switch (props.tone) {
    case 'error':   return 'text-error'
    case 'success': return 'text-success'
    case 'alert':   return 'text-alert'
    case 'primary': return 'text-primary'
    case 'muted':   return 'text-muted'
    default:        return ''
  }
})

const borderClass = computed(() => {
  if (props.active) return 'border-primary/60'
  if (props.tone === 'primary') return 'border-primary/40'
  return 'border-border'
})

const Wrapper = computed(() => props.clickable ? 'button' : 'div')
</script>

<template>
  <component
    :is="Wrapper"
    class="bg-surface-soft border rounded-xl p-4 transition-colors text-left w-full"
    :class="[borderClass, clickable && 'hover:bg-surface-soft-hover hover:border-primary/40 cursor-pointer']"
    :type="clickable ? 'button' : null"
  >
    <div class="flex items-center gap-2">
      <Icon v-if="icon" :name="icon" :size="13" class="text-muted shrink-0" />
      <div class="text-[10px] uppercase tracking-wide text-muted/60 flex-1 min-w-0 truncate">{{ label }}</div>
      <slot name="header-extra" />
    </div>
    <div class="text-2xl font-bold tabular-nums mt-1" :class="valueClass">
      <slot name="value">{{ value }}</slot>
    </div>
    <div v-if="sublabel || $slots.sublabel" class="text-[11px] text-muted mt-1">
      <slot name="sublabel">{{ sublabel }}</slot>
    </div>
  </component>
</template>
