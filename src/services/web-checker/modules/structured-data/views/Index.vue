<script setup>
import SchemaItem from '../components/SchemaItem.vue'
</script>

<template>
  <ModulePage
    moduleId="structured-data"
    label="Strukturierte Daten"
    :itemComponent="SchemaItem"
    runningMessage="Analyse läuft…"
  />
</template>
