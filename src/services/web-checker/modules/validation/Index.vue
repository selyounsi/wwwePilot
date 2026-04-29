<script setup>
import ValidationItem from './components/ValidationItem.vue'
</script>

<template>
  <ModulePage
    moduleId="validation"
    label="HTML-Validierung"
    :itemComponent="ValidationItem"
    runningMessage="HTML wird gegen W3C Nu validiert…"
  />
</template>
