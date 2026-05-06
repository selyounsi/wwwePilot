<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { useClaudeSettings } from '../composables/useClaudeSettings.js'

const { t } = useI18n()
const toast = useToast()
const { keyExists, saveKey, deleteKey, validateKey } = useClaudeSettings()

const input    = ref('')
const saving   = ref(false)
const testing  = ref(false)
const masked   = ref(true)

async function save() {
  const key = input.value.trim()
  if (!key) return
  saving.value = true
  try {
    const check = await validateKey(key)
    if (!check?.ok) {
      toast.error(check?.error ?? t('Could not verify the key.'), { title: t('Validation failed') })
      return
    }
    await saveKey(key)
    toast.success(t('API key saved and verified'))
    input.value = ''
  } finally {
    saving.value = false
  }
}

async function testSaved() {
  testing.value = true
  try {
    const check = await validateKey()
    if (check?.ok) toast.success(t('Saved key is working'))
    else           toast.error(check?.error ?? t('Could not verify the key.'), { title: t('Validation failed') })
  } finally {
    testing.value = false
  }
}

async function remove() {
  await deleteKey()
  toast.info(t('API key removed'))
}
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader showBack :subtitle="t('Settings')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">

      <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
        <div class="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
          <Icon name="mdiKey" :size="14" class="text-muted shrink-0" />
          <span class="text-xs font-medium text-light">{{ t('Claude API Key') }}</span>
        </div>
        <div class="px-3 py-3 flex flex-col gap-3">

          <div v-if="keyExists" class="flex items-center justify-between gap-2 bg-success/10 border border-success/20 rounded-xl px-3 py-2">
            <div class="flex items-center gap-2 min-w-0">
              <Icon name="mdiCheck" :size="14" class="text-success shrink-0" />
              <p class="text-xs text-success truncate">{{ t('API key is saved') }}</p>
            </div>
            <BaseButton
              variant="pill"
              :disabled="testing"
              class="shrink-0"
              @click="testSaved"
            >
              {{ testing ? t('Testing…') : t('Test now') }}
            </BaseButton>
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
              <BaseButton
                variant="icon"
                :icon="masked ? 'mdiEye' : 'mdiEyeOff'"
                :icon-size="13"
                :tooltip="masked ? t('Show key') : t('Hide key')"
                class="shrink-0"
                @click="masked = !masked"
              />
            </div>
          </div>

          <div class="flex gap-2">
            <BaseButton
              :disabled="!input.trim() || saving"
              :loading="saving"
              class="flex-1 py-2 rounded-xl text-xs"
              @click="save"
            >
              {{ saving ? t('Verifying…') : t('Save & test') }}
              <template #loading>{{ t('Verifying…') }}</template>
            </BaseButton>
            <BaseButton
              v-if="keyExists"
              variant="icon-error"
              icon="mdiTrashCan"
              :icon-size="14"
              :tooltip="t('Delete key')"
              class="px-3 py-2 rounded-xl border border-error/20"
              @click="remove"
            />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
