<script setup>
import { ref } from 'vue'
import { useI18n }                from '@/composables/i18n/useI18n.js'
import { useWebCheckerSettings } from '../composables/useWebCheckerSettings.js'

const { t } = useI18n()
const {
  state, builtins,
  addCustomSelector, removeCustomSelector,
  isBuiltinEnabled, toggleBuiltin,
  setDefaultFilter, setShowSearch,
} = useWebCheckerSettings()

const newSelector = ref('')

function submitSelector() {
  if (!newSelector.value.trim()) return
  addCustomSelector(newSelector.value)
  newSelector.value = ''
}
</script>

<template>
  <ServiceSettingsPage>
    <section class="flex flex-col gap-2">
      <SectionLabel>{{ t('Default filter') }}</SectionLabel>

      <div class="bg-surface-soft border border-border rounded-xl px-3 py-3 flex flex-col gap-2">
        <p class="text-[11px] text-muted leading-snug">
          {{ t('Overrides each module\'s configured default filter when set.') }}
        </p>
        <select
          :value="state.defaultFilter ?? ''"
          @change="setDefaultFilter($event.target.value || null)"
          class="bg-surface border border-border text-light text-xs rounded-lg px-3 py-2 outline-none focus:border-primary/50 cursor-pointer"
        >
          <option value="">{{ t('Use module default') }}</option>
          <option value="issues">{{ t('Errors & warnings') }}</option>
          <option value="errors">{{ t('Errors only') }}</option>
          <option value="warnings">{{ t('Warnings only') }}</option>
          <option value="all">{{ t('Show all') }}</option>
        </select>
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <SectionLabel>{{ t('Show search bar') }}</SectionLabel>

      <button
        @click="setShowSearch(!state.showSearch)"
        class="bg-surface-soft border border-border rounded-xl px-3 py-3 flex items-start gap-3 text-left transition-colors hover:border-primary/40"
      >
        <div class="flex-1 flex flex-col gap-1">
          <span class="text-xs font-medium text-light">{{ t('Show search bar') }}</span>
          <span class="text-[11px] text-muted leading-snug">
            {{ t('Adds a search input above the items list of every module.') }}
          </span>
        </div>
        <Icon
          :name="state.showSearch ? 'mdiToggleSwitch' : 'mdiToggleSwitchOffOutline'"
          :size="22"
          class="shrink-0 mt-0.5"
          :class="state.showSearch ? 'text-primary' : 'text-muted/40'"
        />
      </button>
    </section>

    <section class="flex flex-col gap-2">
      <SectionLabel>{{ t('Ignore selectors') }}</SectionLabel>

      <div class="bg-surface-soft border border-border rounded-xl px-3 py-3 flex flex-col gap-3">
        <p class="text-[11px] text-muted leading-snug">
          {{ t('CSS selectors matched here are skipped by checkers (links, validation, …). Useful for third-party widgets you don\'t control.') }}
        </p>

        <div v-if="builtins.length" class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] uppercase tracking-wide text-muted/70">{{ t('Built-in') }}</span>
            <span class="text-[10px] text-muted/50">{{ t('Toggle to enable / disable') }}</span>
          </div>
          <button
            v-for="sel in builtins" :key="sel"
            @click="toggleBuiltin(sel)"
            class="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-left transition-colors"
            :class="isBuiltinEnabled(sel)
              ? 'bg-surface border-border hover:border-primary/40'
              : 'bg-surface/40 border-border/40 opacity-50 hover:opacity-80'"
          >
            <span class="text-xs font-mono text-light truncate flex-1">{{ sel }}</span>
            <Icon
              :name="isBuiltinEnabled(sel) ? 'mdiEye' : 'mdiEyeOff'"
              :size="14"
              class="shrink-0"
              :class="isBuiltinEnabled(sel) ? 'text-primary' : 'text-muted/40'"
            />
          </button>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] uppercase tracking-wide text-muted/70">{{ t('Custom') }}</span>

          <form @submit.prevent="submitSelector" class="flex gap-2">
            <input
              v-model="newSelector"
              type="text"
              :placeholder="t('e.g. .cookie-banner, #widget')"
              class="flex-1 bg-surface border border-border text-light text-xs rounded-lg px-3 py-2 outline-none focus:border-primary/50 placeholder:text-muted/40 font-mono"
            />
            <button
              type="submit"
              :disabled="!newSelector.trim()"
              class="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              :class="newSelector.trim()
                ? 'bg-primary text-black/80 hover:opacity-90'
                : 'bg-surface-soft text-muted/40 cursor-not-allowed'"
            >
              <Icon name="mdiPlus" :size="14" />
            </button>
          </form>

          <div v-if="state.customSelectors.length" class="flex flex-col gap-1.5">
            <div
              v-for="sel in state.customSelectors" :key="sel"
              class="flex items-center justify-between gap-2 bg-surface border border-border rounded-lg px-3 py-2"
            >
              <span class="text-xs font-mono text-light truncate flex-1">{{ sel }}</span>
              <button
                @click="removeCustomSelector(sel)"
                class="text-muted/50 hover:text-error transition-colors shrink-0"
                :title="t('Remove')"
              >
                <Icon name="mdiClose" :size="14" />
              </button>
            </div>
          </div>
          <p v-else class="text-[11px] text-muted/60 italic">
            {{ t('No custom selectors yet.') }}
          </p>
        </div>
      </div>
    </section>
  </ServiceSettingsPage>
</template>
