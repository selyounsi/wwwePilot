<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const isPsi = computed(() => props.item.id === 'psi-mobile' || props.item.id === 'psi-desktop')

const vitals = computed(() => props.item._meta?.vitals ?? [])
const opportunities = computed(() => props.item._meta?.opportunities ?? [])

function vitalColor(score) {
  if (score === null || score === undefined) return 'text-muted/50'
  if (score >= 0.9) return 'text-success'
  if (score >= 0.5) return 'text-alert'
  return 'text-error'
}
function vitalDot(score) {
  if (score === null || score === undefined) return 'bg-muted/30'
  if (score >= 0.9) return 'bg-success'
  if (score >= 0.5) return 'bg-alert'
  return 'bg-error'
}
function vitalLabel(score) {
  if (score === null || score === undefined) return '–'
  if (score >= 0.9) return 'Gut'
  if (score >= 0.5) return 'Verbesserbar'
  return 'Schlecht'
}
function oppColor(score) {
  if (score < 0.5) return 'text-error'
  return 'text-alert'
}
function oppIcon(score) {
  if (score < 0.5) return 'mdiAlertCircleOutline'
  return 'mdiAlertOutline'
}
</script>

<template>
  <ModuleItem :item="item">
    <template v-if="isPsi" #expand>
      <div class="border-t border-border/40 bg-surface-soft">

        <div v-if="!vitals.length && !opportunities.length" class="px-3 py-3 text-xs text-muted/60">
          Keine Detaildaten verfügbar.
        </div>

        <template v-else>

          <div v-if="vitals.length" class="px-3 pt-3 pb-2">
            <p class="text-[10px] uppercase tracking-widest font-semibold text-muted/50 mb-2">Core Web Vitals</p>
            <div class="flex flex-col gap-1.5">
              <div
                v-for="v in vitals"
                :key="v.key"
                class="grid items-center gap-2"
                style="grid-template-columns: 2.5rem 1fr auto auto"
              >
                <span class="text-xs font-mono font-semibold text-muted/70">{{ v.key }}</span>
                <span class="text-xs text-light truncate">{{ v.label }}</span>
                <span class="text-xs font-medium tabular-nums" :class="vitalColor(v.score)">{{ v.value }}</span>
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="vitalDot(v.score)" />
                  <span class="text-[10px] w-20 text-right" :class="vitalColor(v.score)">{{ vitalLabel(v.score) }}</span>
                </span>
              </div>
            </div>
          </div>

          <div v-if="vitals.length && opportunities.length" class="mx-3 border-t border-border/30" />

          <div v-if="opportunities.length" class="px-3 pt-2.5 pb-3">
            <p class="text-[10px] uppercase tracking-widest font-semibold text-muted/50 mb-2">Optimierungshinweise</p>
            <div class="flex flex-col gap-1.5">
              <div
                v-for="(opp, i) in opportunities"
                :key="i"
                class="flex items-start gap-2"
              >
                <Icon :name="oppIcon(opp.score)" :size="12" class="mt-0.5 shrink-0" :class="oppColor(opp.score)" />
                <div class="min-w-0 flex-1">
                  <span class="text-xs text-light">{{ opp.title }}</span>
                  <span v-if="opp.displayValue" class="text-xs text-muted/60 ml-1.5">{{ opp.displayValue }}</span>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div>
    </template>
  </ModuleItem>
</template>
