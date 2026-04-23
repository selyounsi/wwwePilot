<script setup>
import HeadingItem  from './components/HeadingItem.vue'
import HeadingStats from './components/HeadingStats.vue'
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection moduleId="headings" label="Alle Headings" v-slot="{ result }">
      <template v-if="!result || result.status === 'idle'">
        <EmptyState>Noch nicht geprüft – geh zurück und klicke „Seite prüfen"</EmptyState>
      </template>
      <template v-else-if="result.status === 'running'">
        <div class="flex-1 flex items-center justify-center py-12"><LoadingSpinner /></div>
      </template>
      <template v-else>
        <HeadingStats :result="result" />
        <ModuleStats :result="result" :total="false" />
        <HeadingItem v-for="(item, i) in result.items" :key="i" :item="item" />
      </template>
    </ModuleSection>
  </div>
</template>