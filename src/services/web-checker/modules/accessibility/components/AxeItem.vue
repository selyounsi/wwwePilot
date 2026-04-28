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
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

        <div v-if="item.ruleId" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Regel</span>
          <span class="text-xs text-light font-mono break-all">{{ item.ruleId }}</span>
        </div>

        <div v-if="item.impact" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Impact</span>
          <span class="text-xs" :class="item.impact === 'critical' || item.impact === 'serious' ? 'text-error' : 'text-alert'">{{ impactLabel }}</span>
        </div>

        <div v-if="item.target" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Selector</span>
          <span class="text-xs text-light font-mono break-all">{{ item.target }}</span>
        </div>

        <div v-if="item.nodeHtml" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">HTML</span>
          <span class="text-xs text-light font-mono break-all" style="white-space: pre-wrap">{{ item.nodeHtml }}</span>
        </div>

        <div v-if="item.helpUrl" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Doku</span>
          <a :href="item.helpUrl" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline break-all">{{ item.helpUrl }}</a>
        </div>

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
