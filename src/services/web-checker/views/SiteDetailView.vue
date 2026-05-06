<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRunHistory }   from '../composables/useRunHistory.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useI18n }         from '@/composables/i18n/useI18n.js'

const route   = useRoute()
const router  = useRouter()
const { t }   = useI18n()
const history = useRunHistory()
const { modules } = useModuleLoader('web-checker')

const origin = computed(() => String(route.query.origin ?? ''))
const host   = computed(() => { try { return new URL(origin.value).host } catch { return origin.value } })

// One row per module that has at least one historical run for this origin.
// Each row carries the chronological list of entries plus quick aggregates
// for the latest run.
const moduleRows = computed(() => {
  const rows = []
  for (const mod of modules) {
    const key  = `${origin.value}::${mod.id}`
    const list = history.state.byKey[key]
    if (!list || !list.length) continue
    const latest = list[list.length - 1]
    rows.push({
      module:       mod,
      runs:         list,
      latest,
      maxErrors:    Math.max(...list.map(e => e.errorCount   ?? 0), 1),
      maxWarnings:  Math.max(...list.map(e => e.warningCount ?? 0), 1),
    })
  }
  return rows.sort((a, b) => (b.latest.errorCount + b.latest.warningCount) - (a.latest.errorCount + a.latest.warningCount))
})

const totalRuns = computed(() => moduleRows.value.reduce((s, r) => s + r.runs.length, 0))
const lastSeen  = computed(() => Math.max(...moduleRows.value.map(r => r.latest.timestamp), 0))

function relativeTime(ms) {
  if (!ms) return '—'
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60)    return t('just now')
  const min = Math.floor(s / 60)
  if (min < 60)  return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)    return t('{n} h ago',   { n: h })
  const d = Math.floor(h / 24)
  if (d < 7)     return t('{n} d ago',   { n: d })
  return new Date(ms).toLocaleDateString()
}

function openSite() {
  if (origin.value) chrome.tabs.create({ url: origin.value, active: true })
}

function clearAll() {
  if (!origin.value) return
  history.clear(origin.value)
  router.replace('/')
}
</script>

<template>
  <div class="h-screen bg-background flex flex-col">
    <AppHeader showBack :title="host" :subtitle="t('Check history')">
      <button
        @click="openSite"
        class="p-1.5 rounded-lg hover:bg-black/10 text-black/60 transition-colors"
        :title="t('Open in new tab')"
      >
        <Icon name="mdiOpenInNew" :size="14" />
      </button>
    </AppHeader>

    <div class="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto min-h-0">

      <div class="grid grid-cols-3 gap-2 shrink-0">
        <StatBox :label="t('Modules')">{{ moduleRows.length }}</StatBox>
        <StatBox :label="t('Runs')">{{ totalRuns }}</StatBox>
        <StatBox :label="t('Last run')">
          <span class="text-xs">{{ relativeTime(lastSeen) }}</span>
        </StatBox>
      </div>

      <EmptyState v-if="!moduleRows.length">
        {{ t('No history for this site.') }}
      </EmptyState>

      <div
        v-for="row in moduleRows" :key="row.module.id"
        class="bg-surface-soft border border-border rounded-xl p-3 flex flex-col gap-2"
      >
        <div class="flex items-center gap-2">
          <Icon
            v-if="row.module.icon?.startsWith('mdi')"
            :name="row.module.icon" :size="14"
            class="text-muted shrink-0"
          />
          <span class="text-sm font-medium text-light flex-1 truncate">{{ t(row.module.name) }}</span>
          <StatusPill
            :count="row.latest.errorCount || null"
            :warning-count="row.latest.warningCount || null"
          />
        </div>

        <div class="flex items-end gap-0.5 h-10">
          <div
            v-for="(run, i) in row.runs" :key="i"
            class="flex-1 min-w-0 rounded-sm relative group"
            :title="`${new Date(run.timestamp).toLocaleString()}\n${t('{n} errors',   { n: run.errorCount   ?? 0 })}\n${t('{n} warnings', { n: run.warningCount ?? 0 })}`"
            :style="{ height: '100%' }"
          >
            <div
              v-if="(run.errorCount ?? 0) > 0"
              class="absolute bottom-0 left-0 right-0 bg-error/70"
              :style="{ height: ((run.errorCount / row.maxErrors) * 100) + '%' }"
            />
            <div
              v-else-if="(run.warningCount ?? 0) > 0"
              class="absolute bottom-0 left-0 right-0 bg-alert/70"
              :style="{ height: ((run.warningCount / row.maxWarnings) * 100) + '%' }"
            />
            <div
              v-else
              class="absolute bottom-0 left-0 right-0 bg-success/40"
              style="height: 8%"
            />
          </div>
        </div>

        <div class="flex items-center justify-between text-[10px] text-muted/60">
          <span>{{ t('{n} runs', { n: row.runs.length }) }}</span>
          <span>{{ relativeTime(row.runs[0].timestamp) }} → {{ relativeTime(row.latest.timestamp) }}</span>
        </div>
      </div>
    </div>

    <div class="px-4 pt-3 pb-5 bg-background border-t border-border shrink-0 flex flex-col gap-2">
      <BaseButton @click="openSite">
        {{ t('Open and recheck') }}
      </BaseButton>
      <BaseButton variant="ghost" @click="clearAll">
        {{ t('Clear history for this site') }}
      </BaseButton>
    </div>
  </div>
</template>
