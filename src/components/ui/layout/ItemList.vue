<script setup>
/**
 * The standard divided list — wraps a `<ul>` with `divide-y divide-border/30`
 * and exposes `#item` per row. Replaces 10+ raw lists across spellcheck,
 * selectors, flags, system/backups, AdminActivityStream, etc.
 *
 *  <ItemList :items="words" :row-key="w => w.id">
 *    <template #item="{ item }">
 *      <ItemListRow removable @remove="onRemove(item)">
 *        <code>{{ item.word }}</code>
 *      </ItemListRow>
 *    </template>
 *  </ItemList>
 *
 *  <ItemList :items="logs" :max-height="288" empty-text="No events">
 *    <template #item="{ item }">…</template>
 *  </ItemList>
 */

const props = defineProps({
  items:      { type: Array, default: () => [] },
  rowKey:     { type: [Function, String], default: 'id' },
  maxHeight:  { type: [Number, String], default: null },
  emptyText:  { type: String, default: '' },
  scroll:     { type: Boolean, default: true },
})

function keyOf(row, idx) {
  if (typeof props.rowKey === 'function') return props.rowKey(row) ?? idx
  return row?.[props.rowKey] ?? idx
}

const wrapStyle = props.maxHeight
  ? { maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight }
  : null
</script>

<template>
  <div
    :class="[scroll && maxHeight && 'overflow-y-auto']"
    :style="wrapStyle"
  >
    <ul v-if="items.length" class="divide-y divide-border/30">
      <li v-for="(item, i) in items" :key="keyOf(item, i)">
        <slot name="item" :item="item" :index="i" />
      </li>
    </ul>
    <slot v-else name="empty">
      <p v-if="emptyText" class="px-4 py-6 text-center text-xs text-muted/60 italic">{{ emptyText }}</p>
    </slot>
  </div>
</template>
