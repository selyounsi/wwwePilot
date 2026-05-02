<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.message,
  details: props.item.source,
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="list">
    <template #expand v-if="item.stack">
      <DetailRow label="Stack" mono>
        <pre class="whitespace-pre-wrap break-all text-xs">{{ item.stack }}</pre>
      </DetailRow>
    </template>
  </ModuleItem>
</template>
