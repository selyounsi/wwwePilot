<script setup>
import PerformanceItem from './components/PerformanceItem.vue'
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="performance" label="Performance" v-slot="{ result }">

      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>

      <template v-else-if="result.status === 'running'">
        <div class="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </template>

      <template v-else>
        <ModuleStats :result="result" />

        <div class="flex flex-col gap-1.5">
          <PerformanceItem v-for="item in result.items" :key="item.id" :item="item" />
        </div>
      </template>

    </ModuleSection>
  </div>
</template>
