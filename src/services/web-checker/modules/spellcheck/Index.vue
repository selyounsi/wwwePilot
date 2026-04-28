<script setup>
import { ref } from 'vue'
import SpellItem from './components/SpellItem.vue'

// derive groups from slotResult.items so ModuleSection's filter dropdown still applies
function groupItems(items) {
  const map = {}
  for (const item of items ?? []) {
    if (!map[item.category]) map[item.category] = []
    map[item.category].push(item)
  }
  return map
}

const dismissed = ref(new Set())
function dismiss(item) {
  dismissed.value = new Set([...dismissed.value, item.id])
}
const visibleItems = (items) => items.filter(i => !dismissed.value.has(i.id))
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="spellcheck" label="Rechtschreibung" v-slot="{ result }">

      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>

      <template v-else-if="result.status === 'running'">
        <div class="flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3 text-center px-6">
            <LoadingSpinner />
            <p class="text-xs text-muted">Rechtschreibung wird geprüft…<br>Das kann einige Sekunden dauern.</p>
          </div>
        </div>
      </template>

      <template v-else>
        <ModuleStats :result="result" :total="false">
          <StatBox label="Kategorien">{{ Object.keys(groupItems(result.items)).length }}</StatBox>
        </ModuleStats>

        <div v-if="!result.items?.length" class="flex flex-col items-center justify-center gap-2 py-12 text-center px-6">
          <Icon name="mdiCheckCircle" :size="40" class="text-success" />
          <p class="text-sm font-semibold">Keine Fehler gefunden</p>
          <p class="text-xs text-muted">Die Rechtschreibung und Grammatik sehen gut aus.</p>
        </div>

        <div v-else class="flex flex-col gap-5">
          <div v-for="(items, category) in groupItems(result.items)" :key="category">
            <div class="flex items-center justify-between mb-2">
              <SectionLabel>{{ category }}</SectionLabel>
              <span class="text-xs text-muted">{{ visibleItems(items).length }}/{{ items.length }}</span>
            </div>
            <div class="flex flex-col gap-2">
              <SpellItem
                v-for="item in visibleItems(items)"
                :key="item.id"
                :item="item"
                :domain="result.domain"
                @ignore="dismiss"
                @addWord="dismiss"
              />
              <p v-if="!visibleItems(items).length" class="text-xs text-muted text-center py-2">
                Alle Fehler in dieser Kategorie wurden behandelt ✓
              </p>
            </div>
          </div>
        </div>

      </template>
    </ModuleSection>
  </div>
</template>