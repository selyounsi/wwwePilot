<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useCheckStore }    from '@/services/web-checker/composables/useCheckStore.js'
import { APP_NAME }         from '@/config/app.js'

const router = useRouter()
const { services } = useServiceLoader()
const { state } = useCheckStore()

const checkerRunning = computed(() =>
  Object.values(state.results).some(r => r.status === 'running')
)

const checkerErrors = computed(() => {
  const results = Object.values(state.results)
  if (!results.length) return null
  return results.reduce((sum, r) => sum + (r.errorCount ?? 0), 0)
})

const checkerWarnings = computed(() => {
  const results = Object.values(state.results)
  if (!results.length) return null
  return results.reduce((sum, r) => sum + (r.warningCount ?? 0), 0)
})
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader :title="APP_NAME" subtitle="Wähle einen Service" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-2">
      <SectionLabel>Services</SectionLabel>
      <CardItem
        v-for="s in services" :key="s.id"
        :icon="s.icon" :title="s.name" :description="s.description"
        @click="router.push(`/service/${s.id}`)"
      >
        <template v-if="s.id === 'web-checker'">
          <LoadingSpinner v-if="checkerRunning" size="sm" />
          <StatusPill v-else :count="checkerErrors" :warning-count="checkerWarnings" />
        </template>
      </CardItem>
      <EmptyState v-if="services.length === 0">
        Keine aktiven Services gefunden.
      </EmptyState>
    </div>
  </div>
</template>