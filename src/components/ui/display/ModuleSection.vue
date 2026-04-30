<script setup>
import { computed, inject } from 'vue'
import { useModuleSetup }   from '@/services/web-checker/composables/useModuleSetup.js'
import { useModuleFilter }  from '@/services/web-checker/composables/useModuleFilter.js'
import { useModuleLoader }  from '@/composables/loaders/useModuleLoader.js'
import { useCheckStore }    from '@/services/web-checker/composables/useCheckStore.js'
import { useI18n }          from '@/composables/i18n/useI18n.js'

const props = defineProps({
  label:         { type: String, required: true },
  moduleId:      { type: String, default: null },
  defaultFilter: { type: String, default: 'issues' },
})

const { modules } = useModuleLoader('web-checker')
const { t }       = useI18n()
const moduleConfig = props.moduleId ? modules.find(m => m.id === props.moduleId) : null

const setup = moduleConfig
  ? useModuleSetup(
      props.moduleId,
      moduleConfig.overlay      ?? null,
      moduleConfig.allowChatBot ?? false,
    )
  : null

const overlay = setup?.moduleOverlay ?? inject('moduleOverlay', null)

const { state } = useCheckStore()
const { filter, hasIssues, filteredResult } = useModuleFilter(setup?.result ?? null, props.defaultFilter)
const rawResult = computed(() => setup?.result?.value ?? null)

const hasOverlay    = computed(() =>
  (overlay?.hasOverlay ?? false) &&
  (setup?.result?.value?.status === 'done') &&
  (setup?.result?.value?.items?.length ?? 0) > 0
)
const overlayActive = computed(() => overlay?.overlayActive?.value ?? false)
const onText        = computed(() => t(overlay?.onText  ?? 'Hide'))
const offText       = computed(() => t(overlay?.offText ?? 'Show'))
const canRecheck    = computed(() => !!setup && setup.result?.value?.status !== 'running')
const recheckLabel  = computed(() => setup?.result?.value?.status === 'idle' ? t('Check') : t('Recheck'))

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
        <option value="all">{{ t('Show all') }}</option>
        <option value="issues">{{ t('Errors & warnings') }}</option>
        <option value="errors">{{ t('Errors only') }}</option>
        <option value="warnings">{{ t('Warnings only') }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <slot :result="filteredResult" :raw="rawResult" />
    </div>
  </div>
</template>