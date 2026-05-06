<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }          from '@/composables/i18n/useI18n.js'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useUiSettings }    from '@/composables/settings/useUiSettings.js'
import { useAuth }          from '@/composables/auth/useAuth.js'
import { useToast }         from '@/composables/useToast.js'

const router = useRouter()
const { t, lang, setLang, supportedLangs } = useI18n()
const { services } = useServiceLoader()
const {
  state: uiSettings,
  min:   zoomMin,
  max:   zoomMax,
  default: zoomDefault,
  incrementZoom, decrementZoom, resetZoom,
} = useUiSettings()
const { state: authState, logout } = useAuth()
const toast = useToast()

async function onLogout() {
  await logout()
  toast.info(t('Signed out'))
  router.replace({ name: 'login' })
}

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
  <div class="min-h-full bg-background flex flex-col">
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

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
          <div class="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
            <Icon name="mdiMagnifyPlusOutline" :size="14" class="text-muted shrink-0" />
            <span class="text-xs font-medium text-light">{{ t('Zoom level') }}</span>
          </div>
          <div class="px-3 py-3 flex flex-col gap-2">
            <p class="text-[11px] text-muted leading-snug">
              {{ t('Scales only the sidebar — independent of the browser zoom (Ctrl +/-).') }}
            </p>
            <div class="flex items-center gap-2">
              <button
                @click="decrementZoom"
                :disabled="uiSettings.zoom <= zoomMin"
                :title="t('Decrease zoom')"
                class="h-9 w-9 rounded-lg bg-surface border border-border text-muted hover:bg-surface-soft-hover transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon name="mdiMinus" :size="14" />
              </button>
              <button
                @click="resetZoom"
                :title="t('Reset zoom to {n}%', { n: zoomDefault })"
                class="flex-1 h-9 rounded-lg bg-surface border border-border text-light text-xs font-semibold tabular-nums hover:bg-surface-soft-hover transition-colors"
              >
                {{ uiSettings.zoom }}%
              </button>
              <button
                @click="incrementZoom"
                :disabled="uiSettings.zoom >= zoomMax"
                :title="t('Increase zoom')"
                class="h-9 w-9 rounded-lg bg-surface border border-border text-muted hover:bg-surface-soft-hover transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon name="mdiPlus" :size="14" />
              </button>
            </div>
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

      <section v-if="authState.user" class="flex flex-col gap-2">
        <SectionLabel>{{ t('Account') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
          <div class="px-3 py-3 flex items-center gap-3 border-b border-border/60">
            <UserAvatar :user="authState.user" :size="40" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-light truncate">
                {{ authState.user.firstName && authState.user.lastName
                    ? `${authState.user.firstName} ${authState.user.lastName}`
                    : authState.user.name || authState.user.username || authState.user.email }}
              </div>
              <div v-if="authState.user.email" class="text-[11px] text-muted truncate">
                {{ authState.user.email }}
              </div>
            </div>
          </div>

          <div
            v-if="authState.user.roles?.length || authState.user.groups?.length"
            class="px-3 py-2.5 border-b border-border/60 flex flex-col gap-1.5"
          >
            <div v-if="authState.user.roles?.length" class="flex items-start gap-2">
              <span class="text-[10px] uppercase tracking-wide text-muted/60 mt-0.5 w-12 shrink-0">{{ t('Roles') }}</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="r in authState.user.roles" :key="r"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
                >{{ r }}</span>
              </div>
            </div>
            <div v-if="authState.user.groups?.length" class="flex items-start gap-2">
              <span class="text-[10px] uppercase tracking-wide text-muted/60 mt-0.5 w-12 shrink-0">{{ t('Groups') }}</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="g in authState.user.groups" :key="g"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
                >{{ g }}</span>
              </div>
            </div>
          </div>

          <div class="px-3 py-3">
            <BaseButton variant="ghost" @click="onLogout">
              {{ t('Sign out') }}
            </BaseButton>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
