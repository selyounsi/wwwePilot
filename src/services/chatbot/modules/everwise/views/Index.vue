<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useChat } from '@/services/chatbot/composables/useChat.js'
import { suggestions, welcomeText } from '../index.js'

const { t }    = useI18n()
const { send } = useChat()
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
    <div class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-primary shadow-primary/20">
      <Icon name="mdiRobot" :size="28" color="white" />
    </div>
    <div class="flex flex-col gap-1">
      <p class="text-sm font-semibold text-light">{{ t('How can I help you?') }}</p>
      <p class="text-xs text-muted leading-relaxed">{{ t(welcomeText) }}</p>
    </div>
    <div class="flex flex-col gap-2 mt-1 w-full">
      <button
        v-for="s in suggestions" :key="s"
        @click="send(t(s))"
        class="group flex items-center gap-3 text-xs text-left px-4 py-3 bg-surface border border-border rounded-2xl hover:border-primary/40 hover:bg-surface-soft-hover transition-all"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors shrink-0" />
        <span class="text-muted group-hover:text-light transition-colors">{{ t(s) }}</span>
      </button>
    </div>
  </div>
</template>
