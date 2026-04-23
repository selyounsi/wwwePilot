<script setup>
import { computed, inject } from 'vue'
import { useModuleSetup }  from '@/services/web-checker/composables/useModuleSetup.js'
import { useModuleFilter } from '@/services/web-checker/composables/useModuleFilter.js'
import { useCheckStore }   from '@/services/web-checker/composables/useCheckStore.js'

const props = defineProps({
  label:    { type: String, required: true },
  moduleId: { type: String, default: null },
})

const allModules = import.meta.glob('@/services/*/modules/*/index.js', { eager: true })

const checkerModule = props.moduleId
  ? allModules[Object.keys(allModules).find(k => k.includes(`/modules/${props.moduleId}/index.js`))]
  : null

const setup = props.moduleId
  ? useModuleSetup(
      props.moduleId,
      checkerModule?.overlay      ?? null,
      checkerModule?.allowChatBot ?? false,
    )
  : null

const overlay = setup?.moduleOverlay ?? inject('moduleOverlay', null)

const { state } = useCheckStore()
const { filter, hasIssues, filteredResult } = useModuleFilter(setup?.result ?? null)

const hasOverlay    = computed(() =>
  (overlay?.hasOverlay ?? false) &&
  (setup?.result?.value?.status === 'done') &&
  (setup?.result?.value?.items?.length ?? 0) > 0
)
const overlayActive = computed(() => overlay?.overlayActive?.value ?? false)
const onText        = computed(() => overlay?.onText  ?? 'Ausblenden')
const offText       = computed(() => overlay?.offText ?? 'Einblenden')
const canRecheck    = computed(() => !!setup && setup.result?.value?.status !== 'running')
const recheckLabel  = computed(() => setup?.result?.value?.status === 'idle' ? 'Prüfen' : 'Erneut prüfen')

function toggle()   { overlay?.overlayToggle?.() }
function recheck()  { setup?.recheck?.() }
</script>

<template>
  <div class="px-4 mt-4 pb-6">
    <div class="flex items-center justify-between mb-2">
      <SectionLabel>{{ label }}</SectionLabel>
      <div class="flex items-center gap-2">
        <button
          v-if="canRecheck"
          @click="recheck"
          class="text-xs px-2.5 py-1.5 rounded-lg bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Icon name="mdiRefresh" :size="12" />
          {{ recheckLabel }}
        </button>
        <button
          v-if="hasOverlay"
          @click="toggle"
          class="text-xs px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
          :class="overlayActive ? 'bg-primary text-black/70 font-semibold' : 'bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover'"
        >
          {{ overlayActive ? onText : offText }}
        </button>
      </div>
    </div>

    <div v-if="hasIssues" class="mb-3">
      <select
        v-model="filter"
        class="w-full bg-surface-soft border border-border text-muted text-xs rounded-lg px-3 py-2 outline-none focus:border-primary/50 cursor-pointer"
      >
        <option value="all">Alle anzeigen</option>
        <option value="issues">Fehler & Warnungen</option>
        <option value="errors">Nur Fehler</option>
        <option value="warnings">Nur Warnungen</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <slot :result="filteredResult" />
    </div>
  </div>
</template>