<script setup>
const props = defineProps({ result: Object })

const counts = [1, 2, 3, 4, 5, 6].map(level => ({
  tag:   `H${level}`,
  count: props.result.items?.filter(i => i.level === level).length ?? 0
}))
</script>

<template>
  <div class="grid grid-cols-6 gap-2 mb-3">
    <div
      v-for="c in counts" :key="c.tag"
      class="bg-surface-soft border border-border rounded-xl p-2 text-center"
    >
      <p class="text-xs text-muted">{{ c.tag }}</p>
      <p class="text-lg font-bold mt-0.5" :class="c.count === 0 ? 'text-muted/30' : 'text-light'">
        {{ c.count }}
      </p>
    </div>
  </div>
</template>