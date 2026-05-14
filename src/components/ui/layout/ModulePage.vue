<script setup>
import { computed } from 'vue'
import { useModuleLoader }        from '@/composables/loaders/useModuleLoader.js'
import { useWebCheckerSettings } from '@/services/web-checker/composables/useWebCheckerSettings.js'
import { useCheckStore }         from '@/services/web-checker/composables/useCheckStore.js'
import { useActiveTab }          from '@/composables/useActiveTab.js'
import { useI18n }               from '@/composables/i18n/useI18n.js'

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
const defaultFilter = computed(() => settings.defaultFilter ?? config.value?.defaultFilter ?? 'issues')

const checkStore = useCheckStore()
const { tabId: activeTabId, tabUrl: activeTabUrl } = useActiveTab()
const { t } = useI18n()

function pathOf(url) { try { return new URL(url).pathname } catch { return url } }
const checkedShort = computed(() => pathOf(checkStore.state.checkedUrl ?? ''))

function originOf(url) { try { return new URL(url).origin } catch { return null } }
const checkedOrigin = computed(() => originOf(checkStore.state.checkedUrl ?? ''))
const checkedPath   = computed(() => pathOf(checkStore.state.checkedUrl ?? ''))

const tabMismatch = computed(() => {
  if (!checkStore.state.checkedTabId || !checkStore.state.checkedUrl) return false
  if (!activeTabId.value) return false
  if (activeTabId.value === checkStore.state.checkedTabId) return false
  return true
})

async function switchToCheckedTab() {
  const tid = checkStore.state.checkedTabId
  if (!tid) return
  try {
    const tab = await chrome.tabs.get(tid)
    await chrome.windows.update(tab.windowId, { focused: true })
    await chrome.tabs.update(tid, { active: true })
  } catch {}
}
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
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader showBack />

    <div
      v-if="tabMismatch"
      class="mx-4 mt-3 bg-alert/10 border border-alert/40 rounded-xl px-3 py-2.5 flex items-start gap-2"
    >
      <Icon name="mdiAlertCircleOutline" :size="14" class="text-alert shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-[11px] text-light leading-snug">
          {{ t('You are not on the checked page anymore.') }}
        </span>
        <span class="text-[10px] text-muted font-mono truncate">{{ checkedShort }}</span>
      </div>
      <BaseButton
        variant="pill"
        icon="mdiArrowRight"
        :icon-size="11"
        class="shrink-0 text-[10px]!"
        @click="switchToCheckedTab"
      >
        {{ t('Open tab') }}
      </BaseButton>
    </div>

    <ModuleSection :moduleId="moduleId" :label="label" :defaultFilter="defaultFilter" v-slot="{ result, raw }">
      <SiteNotesBanner
        v-if="checkedOrigin && result && result.status !== 'idle' && result.status !== 'running'"
        :origin="checkedOrigin"
        :scope-path="checkedPath"
        :module-id="moduleId"
      />

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
        <ModuleStats v-if="showStats" :result="result" />
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
