<script setup>
import { computed, ref } from 'vue'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'

const props = defineProps({
  token: { type: String, default: null },
})
const emit = defineEmits(['close'])

const { t } = useI18n()
const toast = useToast()
const copied = ref(false)

const isOpen = computed(() => Boolean(props.token))

async function copy() {
  try {
    await navigator.clipboard.writeText(props.token)
    copied.value = true
    toast.success(t('Token copied to clipboard'))
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    toast.error(t('Clipboard write failed — copy manually'))
  }
}
</script>

<template>
  <BaseModal :open="isOpen" size="lg" @update:open="!$event && emit('close')">
    <template #header>
      <div class="flex items-center gap-2">
        <Icon name="mdiAlertOutline" :size="18" class="text-alert" />
        <h3 class="text-base font-semibold">{{ t('Save this token now') }}</h3>
      </div>
    </template>

    <p class="text-xs text-muted mb-3 leading-relaxed">
      {{ t('This is the only time the server will return the raw token. Once you close this dialog, only the prefix remains visible. Mint a new one if you lose it.') }}
    </p>

    <div class="bg-surface border border-border rounded-lg p-3 flex items-center gap-2">
      <code class="text-[11px] text-light break-all flex-1 font-mono">{{ token }}</code>
      <BaseButton
        variant="pill"
        :icon="copied ? 'mdiCheck' : 'mdiContentCopy'"
        :icon-size="13"
        :class="copied ? 'bg-success! border-success! text-black/80!' : 'bg-primary! border-primary! text-black/80!'"
        @click="copy"
      >{{ copied ? t('Copied') : t('Copy') }}</BaseButton>
    </div>

    <template #footer>
      <BaseButton variant="ghost" class="ml-auto" @click="emit('close')">{{ t('I have saved it') }}</BaseButton>
    </template>
  </BaseModal>
</template>
