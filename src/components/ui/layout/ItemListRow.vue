<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

const { t } = useI18n()

/**
 * Single row inside an `<ItemList>`. Provides the `flex items-center gap-2
 * px-4 py-2` shell plus an optional right-aligned Remove button so the
 * dozens of "list with remove icon" patterns stop hand-rolling buttons.
 *
 *  <ItemListRow removable @remove="onDelete(w)">
 *    <code>{{ w.word }}</code>
 *    <span class="text-[10px] text-muted/60 ml-auto">{{ w.source }}</span>
 *  </ItemListRow>
 *
 *  <ItemListRow :active="isActive" clickable @click="select(d)">
 *    {{ d.name }}
 *  </ItemListRow>
 */

const props = defineProps({
  removable:   { type: Boolean, default: false },
  removeIcon:  { type: String, default: 'mdiClose' },
  removeTooltip:{ type: String, default: '' },
  clickable:   { type: Boolean, default: false },
  active:      { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
  dense:       { type: Boolean, default: false },
})

defineEmits(['remove', 'click'])

const padding = computed(() => props.dense ? 'px-3 py-1.5' : 'px-4 py-2')
</script>

<template>
  <div
    class="flex items-center gap-2 transition-colors"
    :class="[
      padding,
      clickable && 'cursor-pointer',
      clickable && (active ? 'bg-primary/10' : 'hover:bg-surface-soft-hover'),
      disabled && 'opacity-60',
    ]"
    @click="clickable && !disabled && $emit('click')"
  >
    <slot />
    <button
      v-if="removable"
      class="p-1 rounded hover:bg-error/10 text-error/70 hover:text-error transition-colors shrink-0"
      :title="removeTooltip || t('Remove')"
      @click.stop="$emit('remove')"
    >
      <Icon :name="removeIcon" :size="12" />
    </button>
  </div>
</template>
