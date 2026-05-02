<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.name,
  details: props.item.provider || props.item.host || '',
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="list" />
</template>
