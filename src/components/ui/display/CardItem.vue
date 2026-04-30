<script setup>
defineProps({
  icon:        { type: String, default: '' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  clickable:   { type: Boolean, default: true },
})
defineEmits(['click'])
</script>

<template>
  <div
    @click="$emit('click')"
    :class="[
      'flex items-center justify-between w-full bg-surface-soft border border-border rounded-xl px-4 py-3 transition-all',
      clickable ? 'hover:bg-surface-soft-hover hover:border-primary/40 cursor-pointer group' : '',
    ]"
  >
    <div class="flex items-center gap-3 min-w-0">
      <Icon v-if="icon?.startsWith('mdi')" :name="icon" :size="20" class="text-muted group-hover:text-primary shrink-0 transition-colors" />
      <span v-else-if="icon" class="text-xl shrink-0">{{ icon }}</span>

      <div class="text-left min-w-0">
        <p class="text-sm font-medium group-hover:text-primary transition-colors">{{ title }}</p>
        <p v-if="description" class="text-xs text-muted truncate">{{ description }}</p>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0 ml-2">
      <slot />
      <Icon v-if="clickable" name="mdiChevronRight" :size="16" class="text-muted/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </div>
  </div>
</template>