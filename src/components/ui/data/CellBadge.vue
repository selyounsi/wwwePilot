<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

const { t } = useI18n()

/**
 * Single source of truth for every pill/badge in admin tables. Adding a new
 * `variant` requires touching ONE map. Existing call sites stay terse:
 *
 *  <CellBadge variant="status"   :value="r.status" />
 *  <CellBadge variant="severity" :value="r.severity" />
 *  <CellBadge variant="scope"    :value="r.scope" :icon="scopeIcon(r.scope)" />
 *  <CellBadge variant="custom"   :value="'Anything'" class-name="bg-primary/15 text-primary" />
 *
 * `:value` is the raw enum value (e.g. `"resolved"`). The component looks up
 * the human label via i18n (so DB enums stay English and the UI follows the
 * user's language), and the color from the variant's map.
 */

const props = defineProps({
  variant:   { type: String, default: 'neutral' },
  value:     { type: [String, Number], default: null },
  label:     { type: String, default: null },
  icon:      { type: String, default: null },
  className: { type: String, default: null },
  size:      { type: String, default: 'xs' },
})

const COLORS = {
  status: {
    open:           'bg-alert/15   text-alert',
    investigating:  'bg-primary/15 text-primary',
    resolved:       'bg-success/15 text-success',
    wont_fix:       'bg-surface    text-muted',
    active:         'bg-success/15 text-success',
    suspended:      'bg-error/15   text-error',
    inactive:       'bg-surface    text-muted',
    deleted:        'bg-error/15   text-error',
    revoked:        'bg-error/15   text-error',
    pending:        'bg-alert/15   text-alert',
    success:        'bg-success/15 text-success',
    failed:         'bg-error/15   text-error',
    error:          'bg-error/15   text-error',
    warning:        'bg-alert/15   text-alert',
    info:           'bg-primary/15 text-primary',
    cancelled:      'bg-surface    text-muted',
    running:        'bg-primary/15 text-primary',
    queued:         'bg-alert/15   text-alert',
    ok:             'bg-success/15 text-success',
    degraded:       'bg-alert/15   text-alert',
    down:           'bg-error/15   text-error',
  },
  severity: {
    high:     'bg-error/15 text-error',
    critical: 'bg-error/15 text-error',
    medium:   'bg-alert/15 text-alert',
    low:      'bg-surface  text-muted',
  },
  category: {
    bug:             'bg-error/15   text-error',
    false_positive:  'bg-alert/15   text-alert',
    feature_request: 'bg-primary/15 text-primary',
    other:           'bg-surface    text-muted',
  },
  scope: {
    app:         'bg-primary/15 text-primary',
    module:      'bg-alert/15   text-alert',
    module_item: 'bg-error/15   text-error',
  },
  kind: {
    single:        'bg-primary/15 text-primary',
    site:          'bg-alert/15   text-alert',
    spellcheck:    'bg-primary/15 text-primary',
    re_check:      'bg-success/15 text-success',
  },
  role: {
    admin:       'bg-error/15   text-error',
    superadmin:  'bg-error/15   text-error',
    user:        'bg-surface    text-muted',
    moderator:   'bg-primary/15 text-primary',
    api:         'bg-primary/15 text-primary',
  },
  neutral: {},
}

const klass = computed(() => {
  if (props.className) return props.className
  const map = COLORS[props.variant] ?? {}
  const v = String(props.value ?? '').toLowerCase()
  return map[v] ?? 'bg-surface text-muted'
})

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'text-[11px] px-2 py-0.5'
  return 'text-[10px] px-1.5 py-0.5'
})

const display = computed(() => {
  if (props.label) return t(props.label)
  if (props.value == null || props.value === '') return ''
  return t(String(props.value))
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded whitespace-nowrap"
    :class="[klass, sizeClass]"
  >
    <Icon v-if="icon" :name="icon" :size="11" />
    <span>{{ display }}</span>
  </span>
</template>
