<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useClaudeSettings } from '../composables/useClaudeSettings.js'

const { t } = useI18n()
const { keyExists, saveKey, deleteKey } = useClaudeSettings()

const input  = ref('')
const saving = ref(false)
const masked = ref(true)

async function save() {
  if (!input.value.trim()) return
  saving.value = true
  await saveKey(input.value.trim())
  saving.value = false
  input.value  = ''
}

async function remove() {
  await deleteKey()
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack :subtitle="t('Settings')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">

      <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
        <div class="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
          <Icon name="mdiKey" :size="14" class="text-muted shrink-0" />
          <span class="text-xs font-medium text-light">{{ t('Claude API Key') }}</span>
        </div>
        <div class="px-3 py-3 flex flex-col gap-3">

          <div v-if="keyExists" class="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-3 py-2">
            <Icon name="mdiCheck" :size="14" class="text-success shrink-0" />
            <p class="text-xs text-success">{{ t('API key is saved') }}</p>
          </div>

          <p v-else class="text-[11px] text-muted leading-snug">
            {{ t('Get your key from console.anthropic.com and paste it here.') }}
          </p>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted">{{ keyExists ? t('New API key') : t('Enter API key') }}</label>
            <div class="flex items-center gap-1 bg-background border border-border rounded-xl px-3 py-2 focus-within:border-primary/60 transition-colors">
              <input
                v-model="input"
                :type="masked ? 'password' : 'text'"
                placeholder="sk-ant-…"
                class="flex-1 bg-transparent text-xs text-light outline-none placeholder:text-muted/40 font-mono"
                @keydown.enter="save"
              />
              <button
                @click="masked = !masked"
                class="text-muted/40 hover:text-muted transition-colors shrink-0"
              >
                <Icon :name="masked ? 'mdiEye' : 'mdiEyeOff'" :size="13" />
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              @click="save"
              :disabled="!input.trim() || saving"
              class="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
              :class="input.trim() && !saving
                ? 'bg-primary text-black/80 hover:opacity-90'
                : 'bg-surface-soft text-muted/40 cursor-not-allowed'"
            >{{ saving ? t('Saving…') : t('Save') }}</button>
            <button
              v-if="keyExists"
              @click="remove"
              class="px-3 py-2 rounded-xl text-xs text-error/70 hover:text-error hover:bg-error/10 border border-error/20 transition-all"
              :title="t('Delete key')"
            >
              <Icon name="mdiTrashCan" :size="14" />
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
