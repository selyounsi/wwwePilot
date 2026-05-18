<script setup>
import { ref } from 'vue'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'

const props = defineProps({
  token: { type: String, default: null },
})
const emit = defineEmits(['close'])

const { t } = useI18n()
const toast = useToast()
const copied = ref(false)

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
  <Teleport to="body">
    <Transition name="reveal-fade">
      <div v-if="token" class="fixed inset-0 bg-black/70 z-50" @click="emit('close')" />
    </Transition>
    <Transition name="reveal-pop">
      <div v-if="token" class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-background border border-alert/40 rounded-2xl w-full max-w-lg shadow-2xl pointer-events-auto p-5" @click.stop>
          <div class="flex items-center gap-2 mb-3">
            <Icon name="mdiAlertOutline" :size="18" class="text-alert shrink-0" />
            <h3 class="text-base font-semibold">{{ t('Save this token now') }}</h3>
          </div>

          <p class="text-xs text-muted mb-3 leading-relaxed">
            {{ t('This is the only time the server will return the raw token. Once you close this dialog, only the prefix remains visible. Mint a new one if you lose it.') }}
          </p>

          <div class="bg-surface border border-border rounded-lg p-3 flex items-center gap-2 mb-4">
            <code class="text-[11px] text-light break-all flex-1 font-mono">{{ token }}</code>
            <BaseButton
              variant="pill"
              :icon="copied ? 'mdiCheck' : 'mdiContentCopy'"
              :icon-size="13"
              :class="copied ? 'bg-success! border-success! text-black/80!' : 'bg-primary! border-primary! text-black/80!'"
              @click="copy"
            >{{ copied ? t('Copied') : t('Copy') }}</BaseButton>
          </div>

          <div class="flex justify-end">
            <BaseButton variant="ghost" @click="emit('close')">{{ t('I have saved it') }}</BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.reveal-fade-enter-active, .reveal-fade-leave-active { transition: opacity .18s ease; }
.reveal-fade-enter-from, .reveal-fade-leave-to       { opacity: 0; }
.reveal-pop-enter-active, .reveal-pop-leave-active   { transition: transform .2s cubic-bezier(.32,.72,0,1), opacity .18s ease; }
.reveal-pop-enter-from, .reveal-pop-leave-to         { transform: scale(.96); opacity: 0; }
</style>
