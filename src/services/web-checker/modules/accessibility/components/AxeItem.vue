<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const IMPACT_LABEL = {
  critical: 'Kritisch',
  serious:  'Schwerwiegend',
  moderate: 'Mittel',
  minor:    'Gering',
  review:   'Manuelle Prüfung',
}

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.target || props.item.ruleId || '',
  details: props.item.ruleId || '',
}))

const impactLabel = computed(() => IMPACT_LABEL[props.item.impact] ?? props.item.impact ?? '')
const impactClass = computed(() =>
  props.item.impact === 'critical' || props.item.impact === 'serious' ? 'text-error' : 'text-alert'
)
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

        <DetailRow v-if="item.ruleId" label="Regel">
          <span class="font-mono">{{ item.ruleId }}</span>
        </DetailRow>

        <DetailRow v-if="item.impact" label="Impact">
          <span :class="impactClass">{{ impactLabel }}</span>
        </DetailRow>

        <DetailRow v-if="item.target" label="Selector">
          <span class="font-mono">{{ item.target }}</span>
        </DetailRow>

        <DetailRow v-if="item.nodeHtml" label="HTML">
          <span class="font-mono" style="white-space: pre-wrap">{{ item.nodeHtml }}</span>
        </DetailRow>

        <DetailRow v-if="item.helpUrl" label="Doku">
          <a :href="item.helpUrl" target="_blank" rel="noreferrer" class="text-primary hover:underline">{{ item.helpUrl }}</a>
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
