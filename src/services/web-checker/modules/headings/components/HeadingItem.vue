<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const indents = { 1: '', 2: 'ml-3', 3: 'ml-6', 4: 'ml-9', 5: 'ml-12', 6: 'ml-14' }

const normalized = computed(() => ({
  ...props.item,
  title:  props.item.text,
  details: props.item.tag,
  indent: indents[props.item.level],
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="list" />
</template>