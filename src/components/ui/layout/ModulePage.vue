<script setup>
import { computed } from 'vue'
import { useModuleLoader }        from '@/composables/loaders/useModuleLoader.js'
import { useWebCheckerSettings } from '@/services/web-checker/composables/useWebCheckerSettings.js'

const props = defineProps({
  moduleId:        { type: String,  required: true },
  label:           { type: String,  required: true },
  itemComponent:   { type: Object,  default: null },
  runningMessage:  { type: String,  default: '' },
  emptyMessage:    { type: String,  default: 'Noch nicht geprüft – geh zurück und klicke „Seite prüfen"' },
  showStats:       { type: Boolean, default: true },
})

const { modules }         = useModuleLoader('web-checker')
const { state: settings } = useWebCheckerSettings()
const config = computed(() => modules.find(m => m.id === props.moduleId))
// service-level override (Web Checker settings) wins over module-config default
const defaultFilter = computed(() => settings.defaultFilter ?? config.value?.defaultFilter ?? 'issues')
</script>

<!--
  Reusable wrapper for a web-checker module page. Replaces the boilerplate of
  AppHeader + ModuleSection + idle/running/done states + ModuleStats + items
  loop that almost every module duplicates.

  Usage:
    <ModulePage moduleId="links" label="Alle Links" :itemComponent="LinkItem" />

  For modules that need custom rendering, override the default slot:
    <ModulePage moduleId="performance" label="Performance">
      <template #default="{ result }">
        <PerformanceCategory v-for="cat in groupBy(result.items)" ... />
      </template>
    </ModulePage>
-->
<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <ModuleSection :moduleId="moduleId" :label="label" :defaultFilter="defaultFilter" v-slot="{ result, raw }">
      <template v-if="!result || result.status === 'idle'">
        <EmptyState>{{ emptyMessage }}</EmptyState>
      </template>

      <template v-else-if="result.status === 'running'">
        <div class="flex-1 flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3">
            <LoadingSpinner />
            <p v-if="runningMessage" class="text-xs text-muted">{{ runningMessage }}</p>
          </div>
        </div>
      </template>

      <template v-else>
        <ModuleStats v-if="showStats" :result="raw ?? result" />
        <slot :result="result" :raw="raw">
          <component
            :is="itemComponent"
            v-for="(item, i) in result.items"
            :key="i"
            :item="item"
          />
        </slot>
      </template>
    </ModuleSection>
  </div>
</template>
