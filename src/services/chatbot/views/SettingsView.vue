<script setup>
import { useI18n }              from '@/composables/i18n/useI18n.js'
import { useChatbotProviders }  from '../composables/useChatbotProviders.js'

const { t } = useI18n()
const { modules, isEnabled, setEnabled, anyEnabled } = useChatbotProviders()
</script>

<template>
  <ServiceSettingsPage>
    <section class="flex flex-col gap-2">
      <SectionLabel>{{ t('Active chatbots') }}</SectionLabel>

      <div class="bg-surface-soft border border-border rounded-xl overflow-hidden flex flex-col">
        <label
          v-for="mod in modules" :key="mod.id"
          class="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-soft-hover border-b border-border/30 last:border-b-0"
        >
          <input
            type="checkbox"
            :checked="isEnabled(mod.id)"
            @change="setEnabled(mod.id, $event.target.checked)"
            class="w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
          />
          <Icon v-if="mod.icon?.startsWith('mdi')" :name="mod.icon" :size="15" class="text-muted shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-light truncate">{{ t(mod.name) }}</div>
            <div v-if="mod.description" class="text-[10px] text-muted truncate">{{ t(mod.description) }}</div>
          </div>
        </label>
      </div>

      <p v-if="!anyEnabled" class="text-[11px] text-error/80 mt-1">
        {{ t('No chatbot enabled — the chat service is currently inactive.') }}
      </p>
      <p v-else class="text-[11px] text-muted/70 mt-1">
        {{ t('Disabled chatbots are completely hidden across the extension.') }}
      </p>
    </section>
  </ServiceSettingsPage>
</template>
