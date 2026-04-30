<script setup>
import { ref } from 'vue'
import SpellItem from '../components/SpellItem.vue'

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
  <ModulePage
    moduleId="spellcheck"
    label="Rechtschreibung"
    :showStats="false"
    runningMessage="Rechtschreibung wird geprüft… Das kann einige Sekunden dauern."
  >
    <template #default="{ result, raw }">
      <ModuleStats :result="raw ?? result" :total="false">
        <StatBox label="Kategorien">{{ Object.keys(groupItems((raw ?? result).items)).length }}</StatBox>
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
  </ModulePage>
</template>
