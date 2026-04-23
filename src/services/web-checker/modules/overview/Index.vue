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
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="overview" label="Website-Übersicht" v-slot="{ result }">

      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>

      <template v-else-if="result.status === 'running'">
        <div class="flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3 text-center px-6">
            <LoadingSpinner />
            <p class="text-xs text-muted">Analyse läuft…<br>Server-Checks werden im Hintergrund ausgeführt.</p>
          </div>
        </div>
      </template>

      <template v-else>
        <ModuleStats :result="result" />

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
    </ModuleSection>
  </div>
</template>
