<script setup>
import { ref, nextTick, watch, computed, onMounted } from 'vue'
import { useChat } from '../composables/useChat.js'
import { useI18n } from '@/composables/i18n/useI18n.js'
import ProviderToggle from '../components/ProviderToggle.vue'

const {
  modules, chats, activeChat, activeModule, messages, isLoading, activeProvider,
  send, clear, newChat, switchChat, deleteChat, copyMessage, setProvider,
} = useChat()
const { t } = useI18n()

const input       = ref('')
const messagesEl  = ref(null)
const showHistory = ref(false)
const copiedId    = ref(null)
const charLimit   = 1000
const charCount   = computed(() => input.value.length)
const nearLimit   = computed(() => charCount.value > charLimit * 0.8)

const accentStyle = computed(() => ({
  backgroundColor: activeModule.value?.accentColor ?? 'var(--color-primary)',
}))

function scrollToBottom() {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (messagesEl.value)
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    })
  })
}

onMounted(() => {
  scrollToBottom()
  setTimeout(scrollToBottom, 150)
})
watch(messages, scrollToBottom, { deep: true })

async function handleSend() {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  await send(text)
  scrollToBottom()
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

async function handleCopy(msg) {
  await copyMessage(msg.content)
  copiedId.value = msg.id
  setTimeout(() => copiedId.value = null, 1500)
}

function retry() {
  const lastUser = [...messages.value].reverse().find(m => m.role === 'user')
  if (!lastUser || isLoading.value) return
  send(lastUser.content)
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
  <div class="h-screen bg-background flex flex-col">
    <AppHeader showBack>
      <template #below>
        <ProviderToggle />
        <div class="flex-1" />
        <button
          @click="showHistory = !showHistory"
          class="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
          :class="showHistory ? 'bg-black/20 text-black/80' : 'text-black/50'"
          :title="t('History')"
        ><Icon name="mdiHistory" :size="15" /></button>
        <button
          @click="newChat"
          class="p-1.5 rounded-lg hover:bg-black/10 text-black/50 transition-colors"
          :title="t('New chat')"
        ><Icon name="mdiPencilOutline" :size="15" /></button>
        <button
          v-if="messages.length"
          @click="clear"
          class="p-1.5 rounded-lg hover:bg-black/10 text-black/50 transition-colors"
          :title="t('Clear chat')"
        ><Icon name="mdiClose" :size="15" /></button>
      </template>
    </AppHeader>

    <div v-if="showHistory" class="border-b border-border bg-surface px-3 py-2 flex flex-col gap-1 max-h-44 overflow-y-auto">
      <p class="text-xs text-muted uppercase tracking-widest mb-1">{{ t('History') }}</p>
      <div v-for="c in chats" :key="c.id" class="flex items-center gap-1.5 group">
        <button
          @click="switchChat(c.id); showHistory = false"
          class="flex-1 text-left text-xs px-3 py-2 rounded-xl transition-colors truncate"
          :class="c.id === activeChat?.id
            ? 'bg-primary/10 text-primary border border-primary/30'
            : 'hover:bg-surface-soft text-muted hover:text-light'"
        >
          {{ c.name }}
          <span class="text-muted/40 ml-1">({{ c.messages.length }})</span>
        </button>
        <button
          v-if="chats.length > 1"
          @click="deleteChat(c.id)"
          class="opacity-0 group-hover:opacity-100 p-1 rounded text-muted/40 hover:text-error transition-all"
        ><Icon name="mdiClose" :size="12" /></button>
      </div>
    </div>

    <div ref="messagesEl" data-chat-messages class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">

      <component v-if="!messages.length && activeModule" :is="activeModule.view" />

      <template v-else>
        <div
          v-for="msg in messages" :key="msg.id"
          class="flex gap-2.5 group"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="msg.role === 'assistant'"
            class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            :style="accentStyle"
          >
            <Icon name="mdiRobot" :size="15" color="white" />
          </div>

          <div class="flex flex-col gap-1 max-w-[82%]" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
            <div
              class="rounded-2xl px-4 py-2.5 text-xs leading-relaxed"
              :class="msg.role === 'user'
                ? 'bg-primary/10 text-light font-medium rounded-tr-sm border border-primary/60'
                : msg.isError
                  ? 'bg-error-soft text-error border border-error/20 rounded-tl-sm'
                  : 'bg-surface border border-border text-light rounded-tl-sm'"
              v-html="format(msg.content)"
            />

            <div
              class="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
              :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
            >
              <span class="text-muted/40" style="font-size:10px">{{ msg.timestamp }}</span>
              <button
                @click="handleCopy(msg)"
                class="text-muted/40 hover:text-muted transition-colors"
                :title="copiedId === msg.id ? t('Copied!') : t('Copy')"
              >
                <Icon :name="copiedId === msg.id ? 'mdiCheck' : 'mdiContentCopy'" :size="11" />
              </button>
              <button
                v-if="msg.isError"
                @click="retry"
                class="text-muted/40 hover:text-alert transition-colors"
                :title="t('Try again')"
              >
                <Icon name="mdiRefresh" :size="11" />
              </button>
            </div>
          </div>

          <div
            v-if="msg.role === 'user'"
            class="w-7 h-7 rounded-xl bg-light/10 border border-light/20 flex items-center justify-center shrink-0 mt-0.5 text-light"
          >
            <Icon name="mdiAccount" :size="15" />
          </div>
        </div>

        <div v-if="isLoading" class="flex gap-2.5 justify-start">
          <div class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" :style="accentStyle">
            <Icon name="mdiRobot" :size="15" color="white" />
          </div>
          <div class="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style="animation-delay:0ms" />
            <span class="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style="animation-delay:150ms" />
            <span class="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style="animation-delay:300ms" />
          </div>
        </div>
      </template>
    </div>

    <div class="px-4 pb-5 pt-3 border-t border-border bg-surface">
      <div
        class="flex gap-2 items-end bg-background border rounded-2xl px-3.5 py-2.5 transition-colors duration-150"
        :class="input.trim() ? 'border-primary' : 'border-primary/30'"
      >
        <textarea
          v-model="input"
          @keydown="handleKeydown"
          :maxlength="charLimit"
          :placeholder="t('Write a message…')"
          rows="1"
          class="flex-1 bg-transparent text-xs outline-none resize-none text-light placeholder:text-muted leading-relaxed"
          style="field-sizing: content; max-height: 120px"
        />
        <button
          @click="handleSend"
          :disabled="!input.trim() || isLoading"
          class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150"
          :class="input.trim() && !isLoading
            ? 'bg-primary text-black/70 hover:scale-110 active:scale-95'
            : 'bg-surface-soft text-muted/30 cursor-not-allowed'"
        >
          <Icon name="mdiSend" :size="13" />
        </button>
      </div>
      <div class="flex items-center justify-between mt-1.5 px-0.5">
        <p class="text-xs text-muted">{{ t('Enter to send · Shift+Enter for new line') }}</p>
        <p class="text-xs transition-colors" :class="nearLimit ? 'text-alert' : 'text-muted/40'">
          {{ charCount }}/{{ charLimit }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
div :deep(strong) { color: var(--color-primary); font-weight: 600; }
</style>
