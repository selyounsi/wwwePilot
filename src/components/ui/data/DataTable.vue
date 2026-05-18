<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

const { t } = useI18n()

/**
 * Generic responsive admin table.
 *
 *  <DataTable
 *    :rows="rows"
 *    :columns="[
 *      { key: 'name',  label: 'Name',  width: 'minmax(160px, 1fr)' },
 *      { key: 'email', label: 'Email', truncate: true },
 *      { key: 'when',  label: 'When',  align: 'right' },
 *    ]"
 *    :loading="state.loading"
 *    :error="state.error"
 *    :row-key="r => r.id"
 *    :on-row-click="openRow"
 *  >
 *    <template #toolbar>... filter widgets ...</template>
 *    <template #cell-when="{ row }"><CellTimestamp :value="row.when" /></template>
 *    <template #row-actions="{ row }"><BaseButton ... /></template>
 *  </DataTable>
 *
 * Responsiveness: horizontal overflow inside a rounded card. Columns can set
 * `width` (any CSS length / minmax) and `minWidth` so the table stays
 * readable on narrow viewports — the wrapper scrolls, the page doesn't.
 * `dense` halves the row padding for sub-tables embedded in detail pages.
 */

const props = defineProps({
  rows:         { type: Array,    default: () => [] },
  columns:      { type: Array,    required: true },
  loading:      { type: Boolean,  default: false },
  error:        { type: [String, Object], default: null },
  rowKey:       { type: [Function, String], default: 'id' },
  onRowClick:   { type: Function, default: null },
  emptyText:    { type: String,   default: '' },
  dense:        { type: Boolean,  default: false },
  hasMore:      { type: Boolean,  default: false },
  loadingMore:  { type: Boolean,  default: false },
  minWidth:     { type: [String, Number], default: null },
})

const emit = defineEmits(['load-more', 'row-click'])

function keyOf(row, idx) {
  if (typeof props.rowKey === 'function') return props.rowKey(row) ?? idx
  return row?.[props.rowKey] ?? idx
}

function valueOf(row, col) {
  if (typeof col.get === 'function') return col.get(row)
  if (!col.key) return ''
  return col.key.split('.').reduce((acc, part) => acc?.[part], row)
}

function alignClass(col) {
  if (col.align === 'right')  return 'text-right'
  if (col.align === 'center') return 'text-center'
  return 'text-left'
}

function colStyle(col) {
  const s = {}
  if (col.width)    s.width    = typeof col.width    === 'number' ? `${col.width}px`    : col.width
  if (col.minWidth) s.minWidth = typeof col.minWidth === 'number' ? `${col.minWidth}px` : col.minWidth
  if (col.maxWidth) s.maxWidth = typeof col.maxWidth === 'number' ? `${col.maxWidth}px` : col.maxWidth
  return s
}

const hasActions = computed(() => false) // reserved for selectable rows

const padX = computed(() => props.dense ? 'px-3' : 'px-4')
const padY = computed(() => props.dense ? 'py-1.5' : 'py-2')
const headPadY = computed(() => props.dense ? 'py-2' : 'py-2.5')

const errorMessage = computed(() => {
  if (!props.error) return null
  if (typeof props.error === 'string') return props.error
  return props.error?.message ?? String(props.error)
})

function handleRowClick(row) {
  if (props.onRowClick) props.onRowClick(row)
  emit('row-click', row)
}
</script>

<template>
  <section class="bg-surface-soft border border-border rounded-xl overflow-hidden">
    <div v-if="$slots.toolbar" class="px-4 py-3 border-b border-border/60 flex flex-wrap gap-2 items-center">
      <slot name="toolbar" />
    </div>

    <div v-if="loading && !rows.length" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="errorMessage" class="p-4 text-error text-sm flex items-center gap-2">
      <Icon name="mdiAlertCircleOutline" :size="14" />
      <span>{{ errorMessage }}</span>
    </div>

    <slot v-else-if="!rows.length" name="empty">
      <p class="px-4 py-8 text-center text-sm text-muted">{{ emptyText || t('Nothing here yet.') }}</p>
    </slot>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm" :style="minWidth ? { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : null">
        <thead class="text-xs uppercase tracking-wide text-muted bg-surface-soft/40">
          <tr>
            <th
              v-for="col in columns" :key="col.key || col.label"
              class="font-medium whitespace-nowrap"
              :class="[padX, headPadY, alignClass(col), col.headerClass]"
              :style="colStyle(col)"
            >{{ col.label ? t(col.label) : '' }}</th>
            <th v-if="$slots['row-actions']" class="px-2" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows" :key="keyOf(row, i)"
            class="border-t border-border/40 transition-colors"
            :class="[onRowClick ? 'hover:bg-surface-soft-hover cursor-pointer' : '']"
            @click="onRowClick && handleRowClick(row)"
          >
            <td
              v-for="col in columns" :key="col.key || col.label"
              :class="[padX, padY, alignClass(col), col.cellClass, col.truncate && 'truncate']"
              :style="colStyle(col)"
              :title="col.titleFrom ? col.titleFrom(row) : (col.truncate ? String(valueOf(row, col) ?? '') : null)"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="valueOf(row, col)" :col="col">
                <template v-if="col.cell">{{ col.cell(row, valueOf(row, col)) }}</template>
                <template v-else>{{ valueOf(row, col) ?? col.fallback ?? '' }}</template>
              </slot>
            </td>
            <td v-if="$slots['row-actions']" class="px-2 py-1 text-right whitespace-nowrap" @click.stop>
              <slot name="row-actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="hasMore" class="border-t border-border/40 px-4 py-2 flex items-center justify-center">
      <BaseButton
        variant="pill"
        :icon="loadingMore ? 'mdiLoading' : 'mdiChevronDown'"
        :icon-size="13"
        :disabled="loadingMore"
        @click="emit('load-more')"
      >{{ loadingMore ? t('Loading…') : t('Load more') }}</BaseButton>
    </div>
  </section>
</template>
