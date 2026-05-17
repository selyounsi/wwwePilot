<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWebChecker }     from '../composables/useWebChecker.js'
import { useSiteCheckStore } from '../composables/useSiteCheckStore.js'
import { useI18n }           from '@/composables/i18n/useI18n.js'
import { useFavorites }      from '@/composables/useFavorites.js'

const router = useRouter()
const {
  modules,
  state,
  isChecking,
  tabStatus,
  errorCount,
  warningCount,
  runChecks,
  switchToCheckedTab,
} = useWebChecker()
const { t } = useI18n()

const { isFavorite, toggle: toggleFavorite } = useFavorites()
const siteCheck = useSiteCheckStore()
const siteCheckCount = computed(() => siteCheck.state.urls.length)
const hasSiteCheck   = computed(() => siteCheckCount.value > 0)
const siteCheckLabel = computed(() => hasSiteCheck.value
  ? t('Back to overview ({count} pages)', { count: siteCheckCount.value })
  : t('Full Website Check'),
)

const sortedModules = computed(() => {
  const order = (mod) => {
    const errors   = state.results[mod.id]?.errorCount   ?? null
    const warnings = state.results[mod.id]?.warningCount ?? null
    if (errors === null)  return 3
    if (errors > 0)       return 0
    if (warnings > 0)     return 1
    return 2
  }
  return [...modules].sort((a, b) => order(a) - order(b))
})

const isLiveEditor   = computed(() => tabStatus.value === 'editor-match')
const alreadyChecked = computed(() => tabStatus.value === 'current' || tabStatus.value === 'url-changed' || tabStatus.value === 'reloaded')

const buttonLabel = computed(() => {
  if (isLiveEditor.value)   return t('Recheck the page')
  if (alreadyChecked.value) return t('Recheck')
  return t('Start check')
})

async function handleCheck() {
  if (isLiveEditor.value) {
    // reloading the live editor tab triggers useTabWatcher to re-run checks automatically
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) chrome.tabs.reload(tab.id)
    return
  }
  runChecks()
}

const hasCheck = computed(() => !!state.checkedTabId)
</script>

<template>
  <div class="h-full bg-background flex flex-col">
    <AppHeader showBack />

    <div class="flex-1 px-4 py-4 flex flex-col gap-2 overflow-y-auto">
      <div class="flex items-center justify-between gap-2">
        <SectionLabel class="shrink-0">{{ t('Modules') }}</SectionLabel>
        <div class="flex items-center gap-1 shrink-0">
          <BaseButton
            variant="square-sm"
            icon="mdiHistory"
            :icon-size="15"
            :tooltip="t('Previous checks')"
            @click="router.push('/service/web-checker/history')"
          />
          <BaseButton
            v-if="hasCheck"
            variant="square-sm"
            icon="mdiPlayCircleOutline"
            :icon-size="15"
            :tooltip="t('Check current tab')"
            @click="runChecks()"
          />
        </div>
      </div>
      <div v-if="state.checkedTabId" class="flex items-center justify-between gap-2 min-w-0 -mt-1 mb-1">
        <TabStatusBadge
          :status="tabStatus"
          :checked-name="state.checkedTabName"
          class="min-w-0 flex-1"
          @switch-tab="switchToCheckedTab"
        />
        <span v-if="state.lastChecked" class="text-xs text-muted shrink-0">{{ state.lastChecked }}</span>
      </div>

      <CardItem
        v-for="mod in sortedModules" :key="mod.id"
        :icon="mod.icon" :title="t(mod.name)" :description="t(mod.description)"
        @click="router.push(`/service/web-checker/module/${mod.id}`)"
      >
        <BaseButton
          variant="icon"
          :icon="isFavorite('web-checker', mod.id) ? 'mdiStar' : 'mdiStarOutline'"
          :icon-size="14"
          :tooltip="isFavorite('web-checker', mod.id) ? t('Remove from favorites') : t('Add to favorites')"
          :class="isFavorite('web-checker', mod.id) ? 'text-primary hover:text-primary' : ''"
          @click.stop="toggleFavorite('web-checker', mod.id)"
        />
        <LoadingSpinner v-if="state.results[mod.id]?.status === 'running'" size="sm" />
        <Tooltip
          v-else-if="state.results[mod.id]?.status === 'skipped'"
          :text="state.results[mod.id]?.skippedReason || ''"
        >
          <span class="text-xs text-muted/60 px-2 py-0.5 rounded-lg bg-surface-soft">{{ t('Skipped') }}</span>
        </Tooltip>
        <StatusPill v-else :count="errorCount(mod.id)" :warning-count="warningCount(mod.id)" />
      </CardItem>
    </div>

    <div class="px-4 pt-3 pb-5 bg-background border-t border-border shrink-0 flex flex-col gap-2">
      <BaseButton :loading="isChecking" @click="handleCheck">
        {{ buttonLabel }}
        <template #loading>{{ t('Checking…') }}</template>
      </BaseButton>
      <BaseButton variant="ghost" @click="router.push('/service/web-checker/site-check')">
        <span class="inline-flex items-center gap-1.5">
          <Icon v-if="hasSiteCheck" name="mdiArrowLeft" :size="13" />
          {{ siteCheckLabel }}
        </span>
      </BaseButton>
    </div>
  </div>
</template>