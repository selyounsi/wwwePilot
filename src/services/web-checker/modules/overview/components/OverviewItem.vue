<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title: props.item.name,
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="box" />
</template>
