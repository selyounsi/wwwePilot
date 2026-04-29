<script setup>
import AxeItem from './components/AxeItem.vue'
</script>

<template>
  <ModulePage
    moduleId="accessibility"
    label="WCAG-Befunde"
    :itemComponent="AxeItem"
    runningMessage="axe-core läuft…"
  />
</template>
