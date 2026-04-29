<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.line ? `Zeile ${props.item.line}, Spalte ${props.item.column}` : 'HTML-Validierung',
  details: props.item.ruleId || '',
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

        <DetailRow v-if="item.ruleId" label="Regel">
          <span class="font-mono">{{ item.ruleId }}</span>
        </DetailRow>

        <DetailRow v-if="item.line" label="Position">
          Zeile {{ item.line }}, Spalte {{ item.column }}
        </DetailRow>

        <DetailRow v-if="item.snippet" label="Stelle">
          <span class="font-mono" style="white-space: pre-wrap">{{ item.snippet }}</span>
        </DetailRow>

        <DetailRow v-if="item.ruleLink" label="Doku">
          <a :href="item.ruleLink" target="_blank" rel="noreferrer" class="text-primary hover:underline">{{ item.ruleLink }}</a>
        </DetailRow>

        <div
          v-for="issue in item.issues"
          :key="issue.message"
          class="text-xs"
          :class="issue.type === 'error' ? 'text-error' : 'text-alert'"
        >{{ issue.message }}</div>

      </div>
    </template>
  </ModuleItem>
</template>
