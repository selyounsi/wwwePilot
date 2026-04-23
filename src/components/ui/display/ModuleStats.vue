<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  result:   { type: Object,  required: true  },
  total:    { type: Boolean, default: true   },
  errors:   { type: Boolean, default: true   },
  warnings: { type: Boolean, default: true   },
})

const open = ref(false)

const allIssues = computed(() => [
  ...(props.result.errors   ?? []).map(e => ({ ...e, type: 'error'   })),
  ...(props.result.warnings ?? []).map(w => ({ ...w, type: 'warning' })),
])
</script>

<template>
  <div class="mb-4 flex flex-col gap-2">

    <!-- Stat-Kacheln -->
    <div class="grid gap-2" style="grid-template-columns: repeat(auto-fit, minmax(72px, 1fr))">

      <div v-if="total" class="bg-surface-soft border border-border rounded-xl p-3 text-center">
        <p class="text-xs text-muted">Gesamt</p>
        <p class="text-lg font-bold mt-0.5">{{ result.items?.length ?? 0 }}</p>
      </div>

      <div v-if="errors" class="bg-error-soft border border-error/30 rounded-xl p-3 text-center">
        <p class="text-xs text-muted">Fehler</p>
        <p class="text-lg font-bold mt-0.5">{{ result.errorCount ?? 0 }}</p>
      </div>

      <div v-if="warnings" class="bg-alert-soft border border-alert/20 rounded-xl p-3 text-center">
        <p class="text-xs text-muted">Warnungen</p>
        <p class="text-lg font-bold mt-0.5">{{ result.warningCount ?? 0 }}</p>
      </div>

      <slot />
    </div>

    <!-- Collapsible Hinweise -->
    <div v-if="allIssues.length" class="rounded-xl border overflow-hidden" :class="open ? 'border-border' : 'border-border/50'">

      <button
        @click="open = !open"
        class="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
        :class="open ? 'bg-surface-soft' : 'bg-surface hover:bg-surface-soft'"
      >
        <Icon
          name="mdiChevronDown"
          :size="14"
          class="transition-transform duration-200 text-muted/60 shrink-0"
          :class="open ? 'rotate-180' : ''"
        />
        <span class="flex-1 text-xs font-medium text-muted">
          {{ open ? 'Hinweise ausblenden' : 'Hinweise anzeigen' }}
        </span>
        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          :class="(result.errorCount ?? 0) > 0 ? 'bg-error/10 text-error' : 'bg-alert/10 text-alert'"
        >{{ allIssues.length }}</span>
      </button>

      <div v-if="open" class="border-t border-border/40 flex flex-col divide-y divide-border/30">
        <div
          v-for="(issue, i) in allIssues"
          :key="i"
          class="flex items-start gap-2.5 px-3 py-2"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
            :class="issue.type === 'error' ? 'bg-error' : 'bg-alert'"
          />
          <span
            class="text-xs"
            :class="issue.type === 'error' ? 'text-error' : 'text-alert'"
          >{{ issue.message }}</span>
        </div>
      </div>

    </div>

  </div>
</template>
