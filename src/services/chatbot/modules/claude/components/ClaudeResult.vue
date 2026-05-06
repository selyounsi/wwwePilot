<script setup>
import { ref, watch } from 'vue'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useToast }  from '@/composables/useToast.js'

const props = defineProps({
  open:    { type: Boolean, required: true },
  title:   { type: String,  default: '' },
  loading: { type: Boolean, default: false },
  error:   { type: String,  default: '' },
  text:    { type: String,  default: '' },
})

const emit = defineEmits(['update:open'])

const { t }   = useI18n()
const toast   = useToast()
const copied  = ref(false)

watch(() => props.open, (v) => { if (!v) copied.value = false })

async function copy() {
  if (!props.text) return
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true
    toast.success(t('Copied to clipboard'))
    setTimeout(() => { copied.value = false }, 1800)
  } catch {
    toast.error(t('Could not copy'))
  }
}

function close() {
  emit('update:open', false)
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function format(text) {
  if (!text) return ''
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-surface rounded px-1 text-primary text-xs">$1</code>')
    .replace(/\n/g, '<br>')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cr-fade">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/50 z-40"
        @click="close"
      />
    </Transition>

    <Transition name="cr-slide">
      <aside
        v-if="open"
        class="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl flex flex-col max-h-[80%] shadow-2xl"
      >
        <div class="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
          <Icon name="mdiAutoFix" :size="16" class="text-primary shrink-0" />
          <span class="text-sm font-semibold text-light flex-1 truncate">{{ title || t('Claude') }}</span>
          <button
            v-if="text && !loading && !error"
            @click="copy"
            class="p-1.5 rounded-lg hover:bg-surface-soft text-muted hover:text-light transition-colors"
            :title="t('Copy')"
          >
            <Icon :name="copied ? 'mdiCheck' : 'mdiContentCopy'" :size="14" />
          </button>
          <button
            @click="close"
            class="p-1.5 rounded-lg hover:bg-surface-soft text-muted hover:text-light transition-colors"
            :title="t('Close')"
          >
            <Icon name="mdiClose" :size="14" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-4">
          <div v-if="loading" class="flex items-center gap-2.5 text-xs text-muted">
            <span class="w-3 h-3 border-2 border-muted/30 border-t-primary rounded-full animate-spin" />
            {{ t('Asking Claude…') }}
          </div>

          <AlertItem v-else-if="error" type="error">{{ error }}</AlertItem>

          <div
            v-else-if="text"
            class="text-xs text-light leading-relaxed prose-claude"
            v-html="format(text)"
          />

          <slot v-else />
        </div>

        <div class="px-4 py-2 border-t border-border/40 text-[10px] text-muted/60 flex items-center gap-1 shrink-0">
          <Icon name="mdiAutoFix" :size="10" />
          {{ t('Powered by Claude') }}
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cr-fade-enter-active, .cr-fade-leave-active { transition: opacity .18s ease; }
.cr-fade-enter-from, .cr-fade-leave-to       { opacity: 0; }
.cr-slide-enter-active, .cr-slide-leave-active { transition: transform .25s cubic-bezier(.32,.72,0,1); }
.cr-slide-enter-from, .cr-slide-leave-to       { transform: translateY(100%); }
.prose-claude :deep(strong) { color: var(--color-primary); font-weight: 600; }
</style>
