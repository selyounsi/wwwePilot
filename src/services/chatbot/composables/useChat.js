import { ref, computed } from 'vue'
import { API } from '@/config/api.js'
import { APP_NAME_LOWER } from '@/config/app.js'

const STORAGE_KEY = `${APP_NAME_LOWER}-chats-v2`

// ── Helpers ───────────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })
}

function newChatObj(provider) {
  return {
    id:       crypto.randomUUID(),
    provider,
    name:     `Chat ${new Date().toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
    messages: [],
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Validate expected shape
      if (parsed.wwwe && parsed.claude) return parsed
    }
  } catch {}
  return {
    wwwe:   [newChatObj('wwwe')],
    claude: [newChatObj('claude')],
  }
}

function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

// ── Singleton State ───────────────────────────────────────
const allChats      = ref(load())
const activeProvider = ref('wwwe')
const activeChatIds = ref({
  wwwe:   allChats.value.wwwe[0]?.id,
  claude: allChats.value.claude[0]?.id,
})
const isLoading = ref(false)
const error     = ref(null)

export function useChat() {
  const chats = computed(() => allChats.value[activeProvider.value] ?? [])
  const activeChat = computed(() =>
    chats.value.find(c => c.id === activeChatIds.value[activeProvider.value]) ?? chats.value[0]
  )
  const messages = computed(() => activeChat.value?.messages ?? [])

  function push(role, content, extra = {}) {
    activeChat.value.messages.push({
      id:        crypto.randomUUID(),
      role,
      content,
      timestamp: now(),
      ...extra,
    })
    save(allChats.value)
  }

  async function send(text) {
    if (!text.trim() || isLoading.value) return
    error.value = null
    push('user', text)
    isLoading.value = true

    try {
      if (activeProvider.value === 'claude') {
        await sendClaude(text)
      } else {
        await sendWwwe(text)
      }
    } finally {
      isLoading.value = false
    }
  }

  async function sendWwwe(text) {
    try {
      const res = await fetch(API.chatbot.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt:   '',
          messages:       messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          currentMessage: text,
          chatInput:      text,
          chat_id:        activeChat.value.id,
          message_id:     crypto.randomUUID(),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data  = await res.json()
      const reply = Array.isArray(data)
        ? data[0]?.output ?? data[0]?.text ?? data[0]?.message ?? JSON.stringify(data[0])
        : data?.output    ?? data?.text    ?? data?.message    ?? JSON.stringify(data)

      push('assistant', reply)
    } catch (e) {
      error.value = e.message
      push('assistant', 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.', { isError: true })
    }
  }

  function sendClaude(text) {
    return new Promise((resolve) => {
      const history = messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      chrome.runtime.sendMessage(
        { type: 'CLAUDE_CHAT', messages: history, currentMessage: text },
        (res) => {
          if (res?.error) {
            error.value = res.error
            push('assistant', `Fehler: ${res.error}`, { isError: true })
          } else {
            push('assistant', res?.reply ?? 'Keine Antwort erhalten.')
          }
          resolve()
        }
      )
    })
  }

  function setProvider(p) {
    activeProvider.value = p
  }

  function clear() {
    if (activeChat.value) {
      activeChat.value.messages = []
      save(allChats.value)
    }
  }

  function newChat() {
    const c = newChatObj(activeProvider.value)
    allChats.value[activeProvider.value].unshift(c)
    activeChatIds.value[activeProvider.value] = c.id
    save(allChats.value)
  }

  function switchChat(id) {
    activeChatIds.value[activeProvider.value] = id
  }

  function deleteChat(id) {
    allChats.value[activeProvider.value] = allChats.value[activeProvider.value].filter(c => c.id !== id)
    if (activeChatIds.value[activeProvider.value] === id)
      activeChatIds.value[activeProvider.value] = allChats.value[activeProvider.value][0]?.id
    if (!allChats.value[activeProvider.value].length) newChat()
    save(allChats.value)
  }

  async function copyMessage(text) {
    await navigator.clipboard.writeText(text).catch(() => {})
  }

  return {
    chats, activeChat, messages, isLoading, error, activeProvider,
    send, clear, newChat, switchChat, deleteChat, copyMessage, setProvider,
  }
}
