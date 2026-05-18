<script setup>
/**
 * BaseCard variant for "labelled section with list/body underneath" —
 * the header always sits in its own bordered bar, never wraps the body
 * padding. Use this for spellcheck panels, settings groups, sub-tables,
 * etc. where the content is its own structure and shouldn't get padding
 * from the wrapper.
 *
 *  <PanelCard title="Dictionary" icon="mdiBookOpenVariantOutline" :count="words.length">
 *    <template #actions> <BaseButton ... /> </template>
 *    <ul>...</ul>
 *  </PanelCard>
 */

defineProps({
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon:     { type: String, default: '' },
  count:    { type: [Number, String], default: null },
  tone:     { type: String, default: 'default' },
})
</script>

<template>
  <BaseCard :tone="tone" no-padding>
    <template #header>
      <div class="flex items-center gap-2 min-w-0">
        <Icon v-if="icon" :name="icon" :size="14" class="text-muted shrink-0" />
        <h4 v-if="title" class="text-sm font-semibold truncate">{{ title }}</h4>
        <span v-if="count != null" class="text-[10px] text-muted tabular-nums">{{ count }}</span>
      </div>
      <p v-if="subtitle" class="text-[10px] text-muted/60 mt-0.5">{{ subtitle }}</p>
    </template>
    <template #actions>
      <slot name="actions" />
    </template>

    <div class="border-t border-border/60">
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </BaseCard>
</template>
