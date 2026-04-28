<script setup>
import AxeItem from './components/AxeItem.vue'
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="accessibility" label="WCAG-Befunde" v-slot="{ result }">
      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>
      <template v-else-if="result.status === 'running'">
        <div class="flex-1 flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3">
            <LoadingSpinner />
            <p class="text-xs text-muted">axe-core läuft…</p>
          </div>
        </div>
      </template>
      <template v-else>
        <ModuleStats :result="result" />
        <AxeItem v-for="(item, i) in result.items" :key="i" :item="item" />
      </template>
    </ModuleSection>
  </div>
</template>
