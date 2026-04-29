<script setup>
import OverviewItem from './components/OverviewItem.vue'

const CATEGORY_ORDER = ['Technik', 'SEO', 'HTML']

function groupByCategory(items) {
  const map = {}
  for (const item of items ?? []) {
    if (!map[item.category]) map[item.category] = []
    map[item.category].push(item)
  }
  const sorted = {}
  for (const cat of CATEGORY_ORDER) {
    if (map[cat]) sorted[cat] = map[cat]
  }
  for (const cat of Object.keys(map)) {
    if (!sorted[cat]) sorted[cat] = map[cat]
  }
  return sorted
}
</script>

<template>
  <ModulePage
    moduleId="overview"
    label="Website-Übersicht"
    runningMessage="Analyse läuft… Server-Checks werden im Hintergrund ausgeführt."
  >
    <template #default="{ result }">
      <div
        v-for="(items, category) in groupByCategory(result.items)"
        :key="category"
        class="flex flex-col gap-2"
      >
        <div class="flex items-center justify-between">
          <SectionLabel>{{ category }}</SectionLabel>
          <span class="text-xs text-muted">
            {{ items.filter(i => i.type === 'success').length }}/{{ items.length }} ✓
          </span>
        </div>
        <div class="flex flex-col gap-1.5">
          <OverviewItem v-for="item in items" :key="item.id" :item="item" />
        </div>
      </div>
    </template>
  </ModulePage>
</template>
