<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWebChecker }     from '../composables/useWebChecker.js'
import { useSiteCheckStore } from '../composables/useSiteCheckStore.js'
import { useCheckTypes }     from '../composables/useCheckTypes.js'
import { useI18n }           from '@/composables/i18n/useI18n.js'
import { useFavorites }      from '@/composables/useFavorites.js'
import ManualTaskPanel       from '../components/ManualTaskPanel.vue'

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

const checkTypes = useCheckTypes()

// `selectedSlug` is the user's pick from the dropdown. Empty = no type =
// fall back to running every module the user has access to. Once Types
// exist the UI hides the manual module-toggles for that run, because the
// admin has decided the bundle.
const selectedSlug = ref('')

onMounted(async () => {
  await checkTypes.fetchAvailable()
  // Auto-select: default type if present, otherwise the only available
  // type, otherwise nothing. Covers the "single profile" case where
  // showing a dropdown with one entry would be pointless.
  if (!selectedSlug.value) {
    const def   = checkTypes.state.available.find(t => t.isDefault)
    const fallback = checkTypes.state.available[0]
    if (def)            selectedSlug.value = def.slug
    else if (fallback)  selectedSlug.value = fallback.slug
  }
})

watch(selectedSlug, async (slug) => {
  await checkTypes.selectType(slug)
})

// Hide the selector when there's nothing meaningful to pick:
//   - feature off
//   - no types at all
//   - exactly one type (it's already active, dropdown would just say so)
const showTypeSelector = computed(() =>
  checkTypes.isCheckTypesEnabled() && checkTypes.state.available.length > 1,
)

const activeType = computed(() => checkTypes.state.active)

const checkedOrigin = computed(() => {
  if (!state.checkedUrl) return ''
  try { return new URL(state.checkedUrl).origin } catch { return '' }
})

const { isFavorite, toggle: toggleFavorite } = useFavorites()
const siteCheck = useSiteCheckStore()
const siteCheckCount = computed(() => siteCheck.state.urls.length)
const hasSiteCheck   = computed(() => siteCheckCount.value > 0)
const siteCheckLabel = computed(() => hasSiteCheck.value
  ? t('Back to overview ({count} pages)', { count: siteCheckCount.value })
  : t('Full Website Check'),
)

// When a check-type is active its `moduleIds` becomes the canonical
// allow-list. Everything else is hidden from the list AND from the
// runner. Falls back to "every loaded module" when no type is selected.
const effectiveModules = computed(() => {
  if (!activeType.value) return modules
  const allow = new Set(activeType.value.type.moduleIds ?? [])
  return modules.filter(m => allow.has(m.id))
})

const sortedModules = computed(() => {
  const order = (mod) => {
    const errors   = state.results[mod.id]?.errorCount   ?? null
    const warnings = state.results[mod.id]?.warningCount ?? null
    if (errors === null)  return 3
    if (errors > 0)       return 0
    if (warnings > 0)     return 1
    return 2
  }
  return [...effectiveModules.value].sort((a, b) => order(a) - order(b))
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
  // When a type is active, restrict the run to the type's module set.
  // Otherwise the default `runChecks()` (no args) uses every loaded module.
  if (activeType.value) runChecks(effectiveModules.value)
  else                  runChecks()
}

const hasCheck = computed(() => !!state.checkedTabId)
</script>

<template>
  <div class="h-full bg-background flex flex-col">
    <AppHeader showBack />

    <div class="flex-1 px-4 py-4 flex flex-col gap-2 overflow-y-auto">
      <div v-if="showTypeSelector" class="bg-surface-soft border border-border rounded-lg px-3 py-2 mb-1">
        <label class="text-[10px] uppercase tracking-wide text-muted/70 block mb-1">
          {{ t('Check type') }}
        </label>
        <SelectField v-model="selectedSlug" dense full-width>
          <option value="" disabled>{{ t('— please pick a profile —') }}</option>
          <option v-for="ct in checkTypes.state.available" :key="ct.id" :value="ct.slug">
            {{ ct.isDefault ? `★ ${ct.name}` : ct.name }}
          </option>
        </SelectField>
        <p v-if="activeType?.type?.description" class="mt-1 text-[10px] text-muted/70">
          {{ activeType.type.description }}
        </p>
      </div>

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

      <ManualTaskPanel
        v-if="activeType && activeType.tasks?.length"
        :url="state.checkedUrl"
        :origin="checkedOrigin"
      />
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