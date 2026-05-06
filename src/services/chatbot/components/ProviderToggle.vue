<script setup>
import { useChat }              from '../composables/useChat.js'
import { useChatbotProviders }  from '../composables/useChatbotProviders.js'
import { useI18n }              from '@/composables/i18n/useI18n.js'

const { activeProvider, setProvider } = useChat()
const { enabledModules } = useChatbotProviders()
const { t } = useI18n()
</script>

<template>
  <div v-if="enabledModules.length > 1" class="flex items-center gap-1 bg-black/10 rounded-xl p-0.5">
    <button
      v-for="m in enabledModules" :key="m.id"
      @click="setProvider(m.id)"
      class="px-3 py-1 rounded-lg text-xs font-medium transition-all"
      :class="activeProvider === m.id
        ? 'bg-white/20 text-black/80 shadow-sm'
        : 'text-black/40 hover:text-black/60'"
    >{{ t(m.name) }}</button>
  </div>
</template>
