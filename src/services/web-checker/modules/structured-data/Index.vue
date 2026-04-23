<script setup>
import SchemaItem from './components/SchemaItem.vue'
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="structured-data" label="Strukturierte Daten" v-slot="{ result }">

      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>

      <template v-else-if="result.status === 'running'">
        <div class="flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3 text-center px-6">
            <LoadingSpinner />
            <p class="text-xs text-muted">Analyse läuft…</p>
          </div>
        </div>
      </template>

      <template v-else>
        <ModuleStats :result="result" />

        <div class="flex flex-col gap-1.5">
          <SchemaItem v-for="item in result.items" :key="item.id" :item="item" />
        </div>
      </template>

    </ModuleSection>
  </div>
</template>
