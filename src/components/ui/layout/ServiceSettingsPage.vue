<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'

const route   = useRoute()
const router  = useRouter()
const { t }   = useI18n()

const serviceId = route.meta.serviceId ?? ''
const { modules } = useModuleLoader(serviceId)

const moduleSettingsModules = import.meta.glob('@/services/*/modules/*/views/SettingsView.vue', { eager: true })
const modulesWithSettings = computed(() => {
  if (!serviceId) return []
  const ids = new Set()
  for (const path in moduleSettingsModules) {
    const parts = path.split('/')
    if (parts[parts.length - 5] !== serviceId) continue
    ids.add(parts[parts.length - 3])
  }
  return modules.filter(m => ids.has(m.id))
})
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack :subtitle="t('Settings')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">
      <slot />

      <section v-if="modulesWithSettings.length" class="flex flex-col gap-2">
        <SectionLabel>{{ t('Module settings') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden flex flex-col">
          <button
            v-for="mod in modulesWithSettings" :key="mod.id"
            @click="router.push(`/service/${serviceId}/module/${mod.id}/settings`)"
            class="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-soft-hover transition-colors border-b border-border/30 last:border-b-0 text-left"
          >
            <Icon v-if="mod.icon" :name="mod.icon" :size="15" class="text-muted shrink-0" />
            <span class="text-xs text-light flex-1 truncate">{{ t(mod.name) }}</span>
            <Icon name="mdiChevronRight" :size="14" class="text-muted/40 shrink-0" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
