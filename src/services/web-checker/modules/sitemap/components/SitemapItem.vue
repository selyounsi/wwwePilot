<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.url,
  details: props.item.details,
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="list" />
</template>
