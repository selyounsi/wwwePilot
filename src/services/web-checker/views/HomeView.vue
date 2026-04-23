<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWebChecker } from '../composables/useWebChecker.js'

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

// Nur editor-match = wirklich die geprüfte Seite im Live Editor
const isLiveEditor   = computed(() => tabStatus.value === 'editor-match')
const alreadyChecked = computed(() => tabStatus.value === 'current' || tabStatus.value === 'url-changed' || tabStatus.value === 'reloaded')

const buttonLabel = computed(() => {
  if (isLiveEditor.value)   return 'Unterseite erneut prüfen'
  if (alreadyChecked.value) return 'Erneut prüfen'
  return 'Prüfung starten'
})

async function handleCheck() {
  if (isLiveEditor.value) {
    // Aktiven Tab (Live Editor) neu laden → useTabWatcher startet Check automatisch
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) chrome.tabs.reload(tab.id)
    return
  }
  runChecks()
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />

    <div class="flex-1 px-4 py-4 flex flex-col gap-2">
      <div class="flex items-center justify-between mb-1">
        <SectionLabel>Module</SectionLabel>
        <div class="flex items-center gap-2">
          <TabStatusBadge
            :status="tabStatus"
            :checked-name="state.checkedTabName"
            @switch-tab="switchToCheckedTab"
          />
          <span v-if="state.lastChecked" class="text-xs text-muted">{{ state.lastChecked }}</span>
        </div>
      </div>

      <CardItem
        v-for="mod in sortedModules" :key="mod.id"
        :icon="mod.icon" :title="mod.name" :description="mod.description"
        @click="router.push(`/service/web-checker/module/${mod.id}`)"
      >
        <LoadingSpinner v-if="state.results[mod.id]?.status === 'running'" size="sm" />
        <StatusPill v-else :count="errorCount(mod.id)" :warning-count="warningCount(mod.id)" />
      </CardItem>
    </div>

    <div class="px-4 pb-5">
      <BaseButton :loading="isChecking" @click="handleCheck">
        {{ buttonLabel }}
        <template #loading>Wird geprüft…</template>
      </BaseButton>
    </div>
  </div>
</template>