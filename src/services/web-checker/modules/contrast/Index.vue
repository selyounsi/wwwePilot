<script setup>
import ContrastItem from './components/ContrastItem.vue'
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="contrast" label="Alle Textelemente" v-slot="{ result }">
      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>
      <template v-else-if="result.status === 'running'">
        <div class="flex-1 flex items-center justify-center py-12"><LoadingSpinner /></div>
      </template>
      <template v-else>
        <ModuleStats :result="result" />
        <ContrastItem
          v-for="(item, i) in result.items"
          :key="i"
          :item="item"
        />
      </template>
    </ModuleSection>
  </div>
</template>
