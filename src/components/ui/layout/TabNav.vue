<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'

const { t } = useI18n()

/**
 * Horizontal tab strip used for switching scopes inside a single view.
 * Currently only one consumer (selectors/Index), but the pattern reappears
 * often enough that the API is worth pinning down.
 *
 *  <TabNav
 *    v-model="activeScope"
 *    :tabs="[{ key: 'global', label: 'Global', count: 12 },
 *            { key: 'site',   label: 'Per site', count: 4 }]"
 *  />
 */

defineProps({
  modelValue: { type: [String, Number], default: '' },
  tabs:       { type: Array, required: true },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <nav class="flex gap-1 mb-4 border-b border-border overflow-x-auto">
    <button
      v-for="tab in tabs" :key="tab.key"
      class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1"
      :class="modelValue === tab.key
        ? 'border-primary text-primary'
        : 'border-transparent text-muted hover:text-light'"
      @click="$emit('update:modelValue', tab.key)"
    >
      <Icon v-if="tab.icon" :name="tab.icon" :size="13" />
      <span>{{ tab.translate === false ? tab.label : t(tab.label) }}</span>
      <span v-if="tab.count != null" class="text-[10px] text-muted/60 tabular-nums">{{ tab.count }}</span>
    </button>
  </nav>
</template>
