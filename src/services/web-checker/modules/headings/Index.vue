<script setup>
import HeadingItem  from './components/HeadingItem.vue'
import HeadingStats from './components/HeadingStats.vue'
</script>

<!-- Headings has an extra HeadingStats above the standard ModuleStats — use ModulePage with a custom items slot -->
<template>
  <ModulePage moduleId="headings" label="Alle Headings" :showStats="false">
    <template #default="{ result, raw }">
      <HeadingStats :result="raw ?? result" />
      <ModuleStats :result="raw ?? result" :total="false" />
      <HeadingItem v-for="(item, i) in result.items" :key="i" :item="item" />
    </template>
  </ModulePage>
</template>
