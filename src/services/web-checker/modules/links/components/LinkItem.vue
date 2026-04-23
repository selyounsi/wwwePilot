<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.text,
  details: props.item.href,
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="list" />
</template>