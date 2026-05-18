<script setup>
import { computed } from 'vue'

/**
 * Right-aligned numeric cell with `tabular-nums`. Optional conditional
 * colorisation:
 *
 *  <CellNumber :value="r.errors"   error-when="> 0" />
 *  <CellNumber :value="r.warnings" alert-when="> 0" />
 *  <CellNumber :value="r.runs"     muted-when="== 0" />
 *
 * The string predicates accept `> 0`, `>= N`, `< N`, `== N`, `!= N`, etc.
 * Empty/null renders as a muted em-dash so cell heights stay aligned.
 */

const props = defineProps({
  value:      { type: [Number, String], default: null },
  emptyText:  { type: String, default: '—' },
  errorWhen:  { type: String, default: null },
  alertWhen:  { type: String, default: null },
  successWhen:{ type: String, default: null },
  mutedWhen:  { type: String, default: null },
  format:     { type: Function, default: null },
})

function evaluate(expr, n) {
  if (!expr) return false
  const m = expr.trim().match(/^(>=|<=|>|<|==|!=)\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (!m) return false
  const [, op, raw] = m
  const target = Number(raw)
  switch (op) {
    case '>':  return n >  target
    case '>=': return n >= target
    case '<':  return n <  target
    case '<=': return n <= target
    case '==': return n === target
    case '!=': return n !== target
  }
  return false
}

const numeric = computed(() => {
  if (props.value == null || props.value === '') return null
  const n = Number(props.value)
  return Number.isFinite(n) ? n : null
})

const colorClass = computed(() => {
  const n = numeric.value
  if (n == null) return 'text-muted/40'
  if (evaluate(props.errorWhen,   n)) return 'text-error'
  if (evaluate(props.alertWhen,   n)) return 'text-alert'
  if (evaluate(props.successWhen, n)) return 'text-success'
  if (evaluate(props.mutedWhen,   n)) return 'text-muted/60'
  return ''
})

const display = computed(() => {
  if (numeric.value == null) return props.emptyText
  if (props.format) return props.format(numeric.value)
  return numeric.value.toLocaleString()
})
</script>

<template>
  <span class="tabular-nums" :class="colorClass">{{ display }}</span>
</template>
