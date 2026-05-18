<script setup>
import { computed } from 'vue'

/**
 * The standard surface for grouped content in the admin shell.
 *
 *  <BaseCard>                        ← raw container, no header
 *    ...
 *  </BaseCard>
 *
 *  <BaseCard title="Roles" subtitle="Click to edit">
 *    <template #actions> <BaseButton ... /> </template>
 *    ...
 *  </BaseCard>
 *
 * Use `tone` for accented variants — `primary` for highlighted results,
 * `danger` for destructive previews. `padding` controls the inner spacing,
 * `no-padding` removes it (useful when the content is its own grid / list).
 */

const props = defineProps({
  title:      { type: String, default: '' },
  subtitle:   { type: String, default: '' },
  icon:       { type: String, default: '' },
  tone:       { type: String, default: 'default' },
  padding:    { type: String, default: 'md' },
  noPadding:  { type: Boolean, default: false },
  divided:    { type: Boolean, default: false },
})

const toneClass = computed(() => {
  switch (props.tone) {
    case 'primary': return 'bg-surface-soft border-primary/30'
    case 'success': return 'bg-success-soft border-success/30'
    case 'danger':  return 'bg-error/5 border-error/30'
    case 'alert':   return 'bg-alert/5 border-alert/30'
    default:        return 'bg-surface-soft border-border'
  }
})

const paddingClass = computed(() => {
  if (props.noPadding) return ''
  switch (props.padding) {
    case 'sm': return 'p-3'
    case 'lg': return 'p-6'
    default:   return 'p-4'
  }
})

const hasHeader = computed(() =>
  Boolean(props.title || props.subtitle || props.icon),
)
</script>

<template>
  <section class="border rounded-xl overflow-hidden" :class="toneClass">
    <header
      v-if="hasHeader || $slots.header || $slots.actions"
      class="flex items-center gap-2 px-4 py-3"
      :class="divided && 'border-b border-border/60'"
    >
      <Icon v-if="icon" :name="icon" :size="16" class="text-muted shrink-0" />
      <div class="flex-1 min-w-0">
        <slot name="header">
          <h3 v-if="title" class="font-semibold text-sm truncate">{{ title }}</h3>
          <p  v-if="subtitle" class="text-[11px] text-muted/70 truncate">{{ subtitle }}</p>
        </slot>
      </div>
      <slot name="actions" />
    </header>

    <div :class="paddingClass">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="px-4 py-2 border-t border-border/40">
      <slot name="footer" />
    </footer>
  </section>
</template>
