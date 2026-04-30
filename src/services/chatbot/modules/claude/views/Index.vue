<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useChat } from '@/services/chatbot/composables/useChat.js'
import { useClaudeSettings } from '../composables/useClaudeSettings.js'
import { suggestions, welcomeText } from '../index.js'

const router = useRouter()
const { t }  = useI18n()
const { send } = useChat()
const { keyExists } = useClaudeSettings()
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
    <div class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style="background-color:#D97757;box-shadow:0 10px 15px -3px rgba(217,119,87,.2),0 4px 6px -4px rgba(217,119,87,.2);">
      <Icon name="mdiRobot" :size="28" color="white" />
    </div>
    <div class="flex flex-col gap-1">
      <p class="text-sm font-semibold text-light">{{ t('How can I help you?') }}</p>
      <p class="text-xs text-muted leading-relaxed">{{ t(welcomeText) }}</p>
    </div>
    <div v-if="!keyExists" class="w-full">
      <button
        @click="router.push('/service/chatbot/module/claude/settings')"
        class="w-full flex items-center gap-3 text-xs text-left px-4 py-3 bg-alert/5 border border-alert/30 rounded-2xl hover:border-alert/60 hover:bg-alert/10 transition-all"
      >
        <Icon name="mdiKey" :size="14" class="text-alert shrink-0" />
        <span class="text-alert/80">{{ t('Add API key to use Claude') }}</span>
      </button>
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
