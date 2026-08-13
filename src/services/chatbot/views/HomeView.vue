<script setup>
import { ref, nextTick, watch, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChat } from '../composables/useChat.js'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useActiveTab, focusOrOpenTab } from '@/composables/useActiveTab.js'
import ProviderToggle from '../components/ProviderToggle.vue'

const {
  anyEnabled, enabledModules,
  chats, activeChat, activeModule, messages, isLoading, canStop,
  send, stop, newChat, switchChat, deleteChat, deleteAllChats, retryLast,
  copyMessage,
} = useChat()
const { t } = useI18n()
const router = useRouter()

const input        = ref('')
const inputEl      = ref(null)
const messagesEl   = ref(null)
const showHistory  = ref(false)
const copiedId     = ref(null)
const confirmClear = ref(false)
let confirmTimer   = null
const charLimit    = 1000
const charCount    = computed(() => input.value.length)
const nearLimit    = computed(() => charCount.value > charLimit * 0.8)

const accentStyle = computed(() => ({
  backgroundColor: activeModule.value?.accentColor ?? 'var(--color-primary)',
}))

const { tabUrl } = useActiveTab()
const activeTabHost = computed(() => {
  try { return tabUrl.value ? new URL(tabUrl.value).host : '' } catch { return '' }
})
const boundHost = computed(() => activeChat.value?.capabilities?.pinnedHost || activeTabHost.value)
const tabDrifted = computed(() => {
  const pinned = activeChat.value?.capabilities?.pinnedHost
  return Boolean(pinned && activeTabHost.value && activeTabHost.value !== pinned)
})

// Consecutive messages of the same kind render as one visual group: avatar and
// extra spacing only on the first message, tight spacing inside the group.
const rows = computed(() => {
  let prevKey = null
  return messages.value.map(msg => {
    const key = msg.kind === 'status' ? 'status' : msg.isError ? 'error' : msg.role
    const groupStart = key !== prevKey
    prevKey = key
    return { msg, groupStart }
  })
})

const lastMessageId = computed(() => messages.value[messages.value.length - 1]?.id)

function chatTitle(c) {
  return c.name || t('New chat')
}

function chatMeta(c) {
  const parts = []
  if (c.createdAt) {
    const d = new Date(c.createdAt)
    const sameDay = d.toDateString() === new Date().toDateString()
    parts.push(sameDay
      ? d.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: '2-digit' }))
  }
  const n = c.messages.length
  parts.push(n === 1 ? t('1 message') : t('{n} messages', { n }))
  return parts.join(' · ')
}

function handleDeleteAll() {
  if (!confirmClear.value) {
    confirmClear.value = true
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => confirmClear.value = false, 5000)
    return
  }
  clearTimeout(confirmTimer)
  confirmClear.value = false
  deleteAllChats()
  showHistory.value = false
}

function goToPinnedTab() {
  const caps = activeChat.value?.capabilities
  if (!caps?.pinnedHost) return
  focusOrOpenTab({ host: caps.pinnedHost, tabId: caps.pinnedTabId, url: caps.pinnedUrl })
}

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
  inputEl.value?.focus()
})
watch(messages, scrollToBottom, { deep: true })

async function handleSend() {
  const text = input.value.trim()
  if (!text || isLoading.value) return
  input.value = ''
  inputEl.value?.focus()
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
  <div class="h-full bg-background flex flex-col">
    <template v-if="!anyEnabled">
      <AppHeader showBack />
      <div class="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="mdiRobot" :size="40" class="text-muted/40" />
        <p class="text-sm text-light max-w-xs">{{ t('No chatbot enabled.') }}</p>
        <p class="text-xs text-muted max-w-xs leading-snug">
          {{ t('Activate at least one chatbot in the chat settings to start a conversation.') }}
        </p>
        <BaseButton variant="ghost" @click="router.push('/service/chatbot/settings')">
          {{ t('Open chat settings') }}
        </BaseButton>
      </div>
    </template>

    <template v-else>
    <AppHeader showBack>
      <!-- Only worth a header row when there is something to switch; with a
           single provider the subtitle already names the assistant. -->
      <template v-if="enabledModules.length > 1" #below>
        <ProviderToggle />
      </template>
    </AppHeader>

    <!-- Once a chat has messages the picker is gone; this keeps the bound
         target visible. It shows the PINNED host, not the live tab, and warns
         when they drift apart. -->
    <div
      v-if="messages.length && activeChat?.capabilities?.cms4"
      class="border-b border-border bg-surface px-3 py-1.5 flex items-center gap-1.5 text-[11px]"
    >
      <Icon name="mdiToyBrickOutline" :size="12" class="text-primary shrink-0" />
      <span class="text-muted">{{ t('CMS4 tools') }}</span>
      <span class="text-muted/40">·</span>
      <code class="text-primary font-mono truncate">{{ boundHost || t('no tab') }}</code>
      <BaseButton
        v-if="tabDrifted"
        variant="pill"
        icon="mdiArrowLeftTop"
        :icon-size="11"
        class="shrink-0 ml-auto"
        :tooltip="t('This chat stays on {pinned}. The current tab shows {current}.', { pinned: boundHost, current: activeTabHost })"
        @click="goToPinnedTab"
      >{{ t('Back to tab') }}</BaseButton>
    </div>

    <div ref="messagesEl" data-chat-messages class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-1.5">

      <component v-if="!messages.length && activeModule" :is="activeModule.view" />

      <template v-else>
        <template v-for="({ msg, groupStart }, i) in rows">

        <!-- Real workflow status line (tool started / finished), not model reasoning -->
        <div
          v-if="msg.kind === 'status'"
          :key="msg.id"
          class="flex items-center gap-2 pl-9 text-[11px]"
          :class="{ 'mt-3': groupStart && i > 0 }"
        >
          <span
            v-if="msg.pending"
            class="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0"
          />
          <Icon
            v-else
            :name="msg.collapsed ? 'mdiToyBrickOutline' : (msg.isError || msg.interrupted ? 'mdiAlertCircleOutline' : 'mdiCheckCircle')"
            :size="12"
            class="shrink-0"
            :class="msg.collapsed ? 'text-muted/60' : (msg.isError || msg.interrupted ? 'text-error' : 'text-success')"
          />
          <span :class="msg.isError || msg.interrupted ? 'text-error' : 'text-muted'">{{ msg.content }}</span>
        </div>

        <!-- Failed turns render as a system notice, not as a chat bubble -->
        <div
          v-else-if="msg.isError"
          :key="msg.id"
          class="flex items-start gap-2.5 bg-error-soft border border-error/20 rounded-xl px-3.5 py-2.5 mr-6"
          :class="{ 'mt-3': groupStart && i > 0 }"
        >
          <Icon name="mdiAlertCircleOutline" :size="14" class="text-error shrink-0 mt-px" />
          <p class="flex-1 text-[11px] text-error leading-relaxed">{{ msg.content }}</p>
          <BaseButton
            v-if="msg.id === lastMessageId && !isLoading"
            variant="pill"
            icon="mdiRefresh"
            :icon-size="11"
            class="shrink-0"
            @click="retryLast"
          >{{ t('Try again') }}</BaseButton>
        </div>

        <div
          v-else
          :key="msg.id"
          class="flex gap-2.5 group"
          :class="[msg.role === 'user' ? 'justify-end' : 'justify-start', { 'mt-3': groupStart && i > 0 }]"
        >
          <div
            v-if="msg.role === 'assistant'"
            class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            :class="{ invisible: !groupStart }"
            :style="accentStyle"
          >
            <Icon name="mdiRobot" :size="15" color="white" />
          </div>

          <div class="flex flex-col gap-1 max-w-[85%]" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
            <div
              class="rounded-2xl px-4 py-2.5 text-xs leading-relaxed"
              :class="msg.role === 'user'
                ? 'bg-primary text-black/85 font-medium rounded-br-md'
                : 'bg-surface border border-border text-light rounded-tl-md'"
              v-html="format(msg.content)"
            />

            <div
              class="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
              :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
            >
              <span class="text-muted/40" style="font-size:10px">{{ msg.timestamp }}</span>
              <BaseButton
                variant="icon"
                :icon="copiedId === msg.id ? 'mdiCheck' : 'mdiContentCopy'"
                :icon-size="11"
                :tooltip="copiedId === msg.id ? t('Copied!') : t('Copy')"
                @click="handleCopy(msg)"
              />
            </div>
          </div>
        </div>

        </template>

        <div v-if="isLoading" class="flex gap-2.5 justify-start items-center mt-3">
          <div class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" :style="accentStyle">
            <Icon name="mdiRobot" :size="15" color="white" />
          </div>
          <div class="bg-surface border border-border rounded-2xl rounded-tl-md px-4 py-3.5 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" style="animation-delay:0ms" />
            <span class="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" style="animation-delay:300ms" />
            <span class="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" style="animation-delay:600ms" />
          </div>
          <BaseButton
            v-if="canStop"
            variant="pill"
            icon="mdiStop"
            :icon-size="12"
            :tooltip="t('Stop')"
            @click="stop"
          >{{ t('Stop') }}</BaseButton>
        </div>
      </template>
    </div>

    <!-- History drawer sits right above its trigger in the input row -->
    <div v-if="showHistory" class="border-t border-border bg-surface px-3 py-2 flex flex-col gap-1 max-h-56 overflow-y-auto">
      <div class="flex items-center justify-between mb-1">
        <p class="text-xs text-muted uppercase tracking-widest">{{ t('History') }}</p>
        <BaseButton
          v-if="chats.length > 1 || chats[0]?.messages.length"
          variant="pill"
          :icon="confirmClear ? 'mdiAlertOutline' : 'mdiDeleteSweepOutline'"
          :icon-size="12"
          :class="confirmClear ? 'text-error!' : ''"
          @click="handleDeleteAll"
        >{{ confirmClear ? t('Really delete all?') : t('Delete all') }}</BaseButton>
      </div>
      <div v-for="c in chats" :key="c.id" class="flex items-center gap-1.5">
        <button
          @click="switchChat(c.id); showHistory = false"
          class="flex-1 min-w-0 text-left px-3 py-2 rounded-xl transition-colors"
          :class="c.id === activeChat?.id
            ? 'bg-primary/10 border border-primary/30'
            : 'hover:bg-surface-soft border border-transparent'"
        >
          <span
            class="block text-xs truncate"
            :class="c.id === activeChat?.id ? 'text-primary' : 'text-light'"
          >{{ chatTitle(c) }}</span>
          <span class="block text-muted/60 mt-0.5" style="font-size:10px">{{ chatMeta(c) }}</span>
        </button>
        <BaseButton
          variant="icon-error"
          icon="mdiTrashCanOutline"
          :icon-size="13"
          :tooltip="t('Delete chat')"
          class="shrink-0"
          @click="deleteChat(c.id)"
        />
      </div>
    </div>

    <div class="px-4 pb-5 pt-3 border-t border-border bg-surface">
      <div
        class="flex gap-2 items-end bg-background border rounded-2xl px-3.5 py-2.5 transition-colors duration-150"
        :class="input.trim() ? 'border-primary' : 'border-primary/30'"
      >
        <textarea
          ref="inputEl"
          v-model="input"
          @keydown="handleKeydown"
          :maxlength="charLimit"
          :placeholder="t('Write a message…')"
          rows="1"
          class="flex-1 bg-transparent text-xs outline-none resize-none text-light placeholder:text-muted leading-relaxed"
          style="field-sizing: content; max-height: 120px"
        />
        <BaseButton
          variant="send"
          icon="mdiSend"
          :tooltip="t('Send')"
          :disabled="!input.trim() || isLoading"
          class="shrink-0"
          @click="handleSend"
        />
      </div>
      <div class="flex items-center justify-between mt-1.5 px-0.5">
        <p class="text-xs text-muted">{{ t('Enter to send · Shift+Enter for new line') }}</p>
        <div class="flex items-center gap-1">
          <p v-if="nearLimit" class="text-xs text-alert mr-1">{{ charCount }}/{{ charLimit }}</p>
          <BaseButton
            variant="icon"
            icon="mdiHistory"
            :icon-size="14"
            :tooltip="t('History')"
            :active="showHistory"
            @click="showHistory = !showHistory"
          />
          <BaseButton
            variant="icon"
            icon="mdiPlus"
            :icon-size="14"
            :tooltip="t('New chat')"
            @click="newChat(); showHistory = false"
          />
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
div :deep(strong) { color: var(--color-primary); font-weight: 600; }
</style>
