<script setup>
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  variant:  { type: String,  default: 'primary' },
  loading:  { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  tooltip:  { type: String,  default: '' },
  icon:     { type: String,  default: '' },
  iconSize: { type: Number,  default: 13 },
  active:   { type: Boolean, default: false },
})

const BLOCK_VARIANTS = new Set(['primary', 'secondary', 'ghost'])
const isBlock = computed(() => BLOCK_VARIANTS.has(props.variant))

const buttonClasses = computed(() => {
  const v = props.variant
  if (isBlock.value) {
    const base = 'w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]'
    if (props.disabled || props.loading) return `${base} bg-surface-soft text-muted cursor-not-allowed`
    if (v === 'secondary') return `${base} bg-secondary hover:opacity-90`
    if (v === 'ghost')     return `${base} bg-surface-soft hover:bg-surface-soft-hover text-muted hover:text-light`
    return `${base} bg-primary hover:opacity-90 hover:brightness-110`
  }
  if (v === 'pill') {
    return 'inline-flex items-center gap-1.5 px-2 py-1 bg-surface-soft border border-border hover:bg-surface-soft-hover text-light text-[11px] rounded-md transition-all disabled:opacity-50'
  }
  if (v === 'header-icon') {
    const base = 'inline-flex items-center justify-center p-1.5 rounded-lg transition-colors'
    return props.active ? `${base} bg-black/20 text-black/80` : `${base} hover:bg-black/10 text-black/50`
  }
  if (v === 'square') {
    return 'inline-flex items-center justify-center h-9 w-9 rounded-lg bg-surface border border-border text-muted hover:bg-surface-soft-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
  }
  if (v === 'square-sm') {
    const base = 'inline-flex items-center justify-center h-7 w-7 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
    return props.active
      ? `${base} bg-primary text-black/70`
      : `${base} bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover`
  }
  if (v === 'pill-toggle') {
    const base = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg transition-colors disabled:opacity-30'
    return props.active
      ? `${base} bg-primary text-black/70 font-semibold`
      : `${base} bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover`
  }
  if (v === 'surface-icon') {
    return 'inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-soft text-muted hover:text-light transition-colors'
  }
  if (v === 'circle') {
    return 'inline-flex items-center justify-center rounded-full ring-2 ring-black/10 hover:ring-black/30 transition-all'
  }
  if (v === 'send') {
    if (props.disabled || props.loading) return 'inline-flex items-center justify-center w-7 h-7 rounded-xl bg-surface-soft text-muted/30 cursor-not-allowed transition-all duration-150'
    return 'inline-flex items-center justify-center w-7 h-7 rounded-xl bg-primary text-black/70 hover:scale-110 active:scale-95 transition-all duration-150'
  }
  const iconBase = 'inline-flex items-center justify-center p-0.5 rounded transition-all hover:scale-110 disabled:opacity-40 disabled:hover:scale-100'
  if (v === 'icon-error')   return `${iconBase} text-muted hover:text-error hover:bg-error/10`
  if (v === 'icon-success') return `${iconBase} text-muted hover:text-success hover:bg-success/10`
  if (v === 'icon-alert')   return `${iconBase} text-muted hover:text-alert hover:bg-alert/10`
  return `${iconBase} text-muted hover:text-primary hover:bg-primary/10`
})
</script>

<template>
  <Tooltip :text="tooltip">
    <button
      v-bind="$attrs"
      :disabled="disabled || loading"
      :class="buttonClasses"
    >
      <template v-if="loading">
        <span v-if="isBlock" class="flex items-center justify-center gap-2">
          <span class="w-4 h-4 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
          <slot name="loading">Wird geladen…</slot>
        </span>
        <span v-else class="w-3 h-3 border-2 border-muted/30 border-t-primary rounded-full animate-spin" />
      </template>
      <template v-else>
        <Icon v-if="icon" :name="icon" :size="iconSize" />
        <slot />
      </template>
    </button>
  </Tooltip>
</template>
