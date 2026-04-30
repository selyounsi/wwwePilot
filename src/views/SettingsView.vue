<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }          from '@/composables/i18n/useI18n.js'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'

const router = useRouter()
const { t, lang, setLang, supportedLangs } = useI18n()
const { services } = useServiceLoader()

const subViewModules = import.meta.glob('@/services/*/views/*View.vue', { eager: true })
const servicesWithSettings = computed(() => {
  const ids = new Set()
  for (const path in subViewModules) {
    const parts    = path.split('/')
    const fileName = parts[parts.length - 1]
    if (fileName === 'SettingsView.vue') ids.add(parts[parts.length - 3])
  }
  return services.filter(s => ids.has(s.id))
})
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack :title="t('Settings')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

      <section class="flex flex-col gap-2">
        <SectionLabel>{{ t('General settings') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
          <div class="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
            <Icon name="mdiTranslate" :size="14" class="text-muted shrink-0" />
            <span class="text-xs font-medium text-light">{{ t('Language') }}</span>
          </div>
          <div class="px-3 py-3 flex gap-2">
            <button
              v-for="code in supportedLangs" :key="code"
              @click="setLang(code)"
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              :class="lang === code
                ? 'bg-primary text-black/80'
                : 'bg-surface border border-border text-muted hover:bg-surface-soft-hover'"
            >
              {{ code.toUpperCase() }}
            </button>
          </div>
        </div>
      </section>

      <section v-if="servicesWithSettings.length" class="flex flex-col gap-2">
        <SectionLabel>{{ t('Service settings') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden flex flex-col">
          <button
            v-for="s in servicesWithSettings" :key="s.id"
            @click="router.push(`/service/${s.id}/settings`)"
            class="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-soft-hover transition-colors border-b border-border/30 last:border-b-0 text-left"
          >
            <Icon v-if="s.icon" :name="s.icon" :size="15" class="text-muted shrink-0" />
            <span class="text-xs text-light flex-1 truncate">{{ t(s.name) }}</span>
            <Icon name="mdiChevronRight" :size="14" class="text-muted/40 shrink-0" />
          </button>
        </div>
      </section>

    </div>
  </div>
</template>
