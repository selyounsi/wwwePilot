import { ref, computed, watch } from 'vue'
import { APP_NAME_LOWER } from '@/config/app.js'
import { useI18n }              from '@/composables/i18n/useI18n.js'
import { useModuleLoader }      from '@/composables/loaders/useModuleLoader.js'
import { useChatbotProviders }  from './useChatbotProviders.js'

const STORAGE_KEY = `${APP_NAME_LOWER}-chats-v2`

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

function loadChats(modules) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const result = {}
        for (const m of modules) {
          result[m.id] = Array.isArray(parsed[m.id]) && parsed[m.id].length
            ? parsed[m.id]
            : [newChatObj(m.id)]
        }
        return result
      }
    }
  } catch {}
  const result = {}
  for (const m of modules) result[m.id] = [newChatObj(m.id)]
  return result
}

function saveChats(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

// Lazy singletons — initialized on first useChat() call. Initializing at
// module-top would deadlock against a circular import: useModuleLoader's
// eager glob loads each module's views/Index.vue, and those import useChat.
let modules, allChats, activeProvider, activeChatIds, isLoading, error, providers

function init() {
  if (modules) return
  modules        = useModuleLoader('chatbot').modules
  providers      = useChatbotProviders()
  allChats       = ref(loadChats(modules))
  activeProvider = ref(providers.enabledModules.value[0]?.id ?? modules[0]?.id ?? '')
  activeChatIds  = ref(Object.fromEntries(modules.map(m => [m.id, allChats.value[m.id]?.[0]?.id])))
  isLoading      = ref(false)
  error          = ref(null)

  // Auto-switch to the first enabled provider whenever the active one is
  // disabled in settings, so the chat view doesn't get stuck on an invisible
  // provider.
  watch(
    () => providers.isEnabled(activeProvider.value),
    (stillEnabled) => {
      if (stillEnabled) return
      const next = providers.enabledModules.value[0]?.id
      if (next) activeProvider.value = next
    },
  )
}

export function useChat() {
  init()
  const { t } = useI18n()

  const chats        = computed(() => allChats.value[activeProvider.value] ?? [])
  const activeChat   = computed(() =>
    chats.value.find(c => c.id === activeChatIds.value[activeProvider.value]) ?? chats.value[0]
  )
  const messages     = computed(() => activeChat.value?.messages ?? [])
  const activeModule = computed(() => modules.find(m => m.id === activeProvider.value))

  function push(role, content, extra = {}) {
    if (!activeChat.value) return
    activeChat.value.messages.push({
      id:        crypto.randomUUID(),
      role,
      content,
      timestamp: now(),
      ...extra,
    })
    saveChats(allChats.value)
  }

  async function send(text) {
    if (!text.trim() || isLoading.value) return
    error.value = null
    push('user', text)
    isLoading.value = true

    try {
      const mod = activeModule.value
      if (!mod?.checker) {
        push('assistant', t('Sorry, an error occurred. Please try again.'), { isError: true })
        return
      }

      const history = messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      const result  = await mod.checker({ text, history, chatId: activeChat.value.id })

      if (result?.error) {
        error.value = result.error
        push('assistant', t('Error: {message}', { message: result.error }), { isError: true })
      } else {
        push('assistant', result?.reply ?? t('No response received.'))
      }
    } catch (e) {
      error.value = e.message
      push('assistant', t('Sorry, an error occurred. Please try again.'), { isError: true })
    } finally {
      isLoading.value = false
    }
  }

  function setProvider(id) {
    if (modules.find(m => m.id === id) && providers.isEnabled(id)) activeProvider.value = id
  }

  function clear() {
    if (activeChat.value) {
      activeChat.value.messages = []
      saveChats(allChats.value)
    }
  }

  function newChat() {
    const c = newChatObj(activeProvider.value)
    if (!allChats.value[activeProvider.value]) allChats.value[activeProvider.value] = []
    allChats.value[activeProvider.value].unshift(c)
    activeChatIds.value[activeProvider.value] = c.id
    saveChats(allChats.value)
  }

  function switchChat(id) {
    activeChatIds.value[activeProvider.value] = id
  }

  function deleteChat(id) {
    allChats.value[activeProvider.value] = allChats.value[activeProvider.value].filter(c => c.id !== id)
    if (activeChatIds.value[activeProvider.value] === id)
      activeChatIds.value[activeProvider.value] = allChats.value[activeProvider.value][0]?.id
    if (!allChats.value[activeProvider.value].length) newChat()
    saveChats(allChats.value)
  }

  async function copyMessage(text) {
    await navigator.clipboard.writeText(text).catch(() => {})
  }

  return {
    modules,
    enabledModules: providers.enabledModules,
    anyEnabled: providers.anyEnabled,
    chats, activeChat, activeModule, messages, isLoading, error, activeProvider,
    send, clear, newChat, switchChat, deleteChat, copyMessage, setProvider,
  }
}
