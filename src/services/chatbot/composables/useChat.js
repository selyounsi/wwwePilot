import { ref, computed, watch } from 'vue'
import { APP_NAME_LOWER } from '@/config/app.js'
import { useI18n }              from '@/composables/i18n/useI18n.js'
import { useModuleLoader }      from '@/composables/loaders/useModuleLoader.js'
import { useChatbotProviders }  from './useChatbotProviders.js'

const STORAGE_KEY = `${APP_NAME_LOWER}-chats-v2`

function now() {
  return new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })
}

// Per-chat capability set, chosen before the first message. Kept on the chat
// (not in module settings) so parallel chats can target different sites.
// `pinnedHost` freezes the domain the chat works on: switching browser tabs
// mid-conversation must never redirect an edit to a different website. The tab
// id and url are kept only to jump back to (or reopen) that page.
function defaultCapabilities() {
  return { cms4: false, target: 'activeTab', pinnedHost: '', pinnedTabId: null, pinnedUrl: '' }
}

function newChatObj(provider) {
  return {
    id:       crypto.randomUUID(),
    provider,
    name:     `Chat ${new Date().toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
    messages: [],
    capabilities: defaultCapabilities(),
  }
}

// Status lines are live progress; once a turn is history they only add noise and
// eat into the localStorage budget. Collapse each turn's lines into one summary
// when a stored chat is loaded.
function collapseStatusLines(messages) {
  if (!Array.isArray(messages)) return []
  const out = []
  const summaryFor = new Map()
  for (const m of messages) {
    if (m?.kind !== 'status') { out.push(m); continue }
    const key = m.turnId ?? m.id
    const existing = summaryFor.get(key)
    if (existing) {
      existing.tools.push(m.tool)
      existing.msg.content = `${existing.tools.length}× ${existing.tools.join(', ')}`
      continue
    }
    const msg = { ...m, pending: false, interrupted: false, content: m.tool ?? m.content, collapsed: true }
    summaryFor.set(key, { msg, tools: [m.tool].filter(Boolean) })
    out.push(msg)
  }
  return out
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
            ? parsed[m.id].map(c => ({
                ...c,
                capabilities: { ...defaultCapabilities(), ...c.capabilities },
                messages:     collapseStatusLines(c.messages),
              }))
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
let modules, allChats, activeProvider, activeChatIds, isLoading, error, providers, abortCurrent

function init() {
  if (modules) return
  modules        = useModuleLoader('chatbot').modules
  providers      = useChatbotProviders()
  allChats       = ref(loadChats(modules))
  activeProvider = ref(providers.enabledModules.value[0]?.id ?? modules[0]?.id ?? '')
  activeChatIds  = ref(Object.fromEntries(modules.map(m => [m.id, allChats.value[m.id]?.[0]?.id])))
  isLoading      = ref(false)
  error          = ref(null)
  abortCurrent   = ref(null)

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

  // Assistant turns are replayed as their raw blocks when available (tool calls
  // + results), otherwise as plain text. Grouping by turnId prevents sending a
  // turn twice — once as blocks, once as its streamed text messages.
  function buildHistory() {
    const out = []
    const replayed = new Set()
    for (const m of messages.value.slice(0, -1)) {
      if (m.isError) continue
      if (m.role === 'user') { out.push({ role: 'user', content: m.content }); continue }
      if (m.turnId && replayed.has(m.turnId)) continue
      if (m.blocks?.length) {
        if (m.turnId) replayed.add(m.turnId)
        out.push({ role: 'assistant', content: m.blocks })
        continue
      }
      if (m.kind === 'status') continue
      out.push({ role: 'assistant', content: m.content })
    }
    return out
  }

  async function send(text) {
    if (!text.trim() || isLoading.value) return
    error.value = null
    const history = buildHistory()
    push('user', text)
    isLoading.value = true

    // Tracks in-flight tool status lines so `tool_end` can flip the same
    // message to done instead of appending a second line.
    const pendingTools = new Map()
    const turnId = crypto.randomUUID()
    let streamedAny = false

    function onEvent(ev) {
      const chat = activeChat.value
      if (!chat) return
      switch (ev?.type) {
        case 'text':
          if (!ev.text?.trim()) return
          streamedAny = true
          push('assistant', ev.text, { turnId })
          break
        case 'tool_start': {
          const id = crypto.randomUUID()
          pendingTools.set(ev.toolId ?? ev.name, id)
          push('assistant', t('Using CMS tool {tool}…', { tool: ev.name }), {
            id, kind: 'status', pending: true, tool: ev.name, turnId,
          })
          break
        }
        case 'tool_end': {
          const msgId = pendingTools.get(ev.toolId ?? ev.name)
          const msg   = msgId && chat.messages.find(m => m.id === msgId)
          if (msg) {
            msg.pending = false
            msg.isError = !!ev.isError
            msg.content = ev.isError
              ? t('CMS tool {tool} failed', { tool: ev.name })
              : t('CMS tool {tool} done', { tool: ev.name })
            pendingTools.delete(ev.toolId ?? ev.name)
            saveChats(allChats.value)
          }
          break
        }
      }
    }

    try {
      const mod = activeModule.value
      if (!mod?.checker) {
        push('assistant', t('Sorry, an error occurred. Please try again.'), { isError: true })
        return
      }

      const result = await mod.checker({
        text,
        history,
        chatId:       activeChat.value.id,
        capabilities: { ...activeChat.value.capabilities },
        onEvent,
        onAbortReady: (stop) => { abortCurrent.value = stop },
      })

      if (result?.error) {
        error.value = result.error
        push('assistant', t('Error: {message}', { message: result.error }), { isError: true })
      } else if (result?.reply) {
        // Streaming already pushed the text; only append when nothing arrived.
        if (!streamedAny) push('assistant', result.reply, { turnId })
      } else if (result?.aborted) {
        if (!streamedAny) push('assistant', t('Stopped.'), { turnId })
      } else if (!streamedAny) {
        push('assistant', t('No response received.'), { turnId })
      }

      // Park the raw blocks on the turn's first message so the next request can
      // replay the tool calls instead of only the narration.
      if (result?.blocks?.length) {
        const first = activeChat.value?.messages.find(m => m.turnId === turnId && m.kind !== 'status')
        if (first) first.blocks = result.blocks
      }
    } catch (e) {
      error.value = e.message
      push('assistant', t('Sorry, an error occurred. Please try again.'), { isError: true })
    } finally {
      // Never leave a spinner behind if the stream died mid-tool.
      for (const msgId of pendingTools.values()) {
        const msg = activeChat.value?.messages.find(m => m.id === msgId)
        if (msg) { msg.pending = false; msg.interrupted = true }
      }
      pendingTools.clear()
      saveChats(allChats.value)
      abortCurrent.value = null
      isLoading.value = false
    }
  }

  function stop() {
    abortCurrent.value?.()
  }

  function setCapabilities(patch) {
    if (!activeChat.value) return
    Object.assign(activeChat.value.capabilities, patch)
    // Turning tools off releases the pin so the next activation re-reads the tab.
    if (patch.cms4 === false) {
      Object.assign(activeChat.value.capabilities, { pinnedHost: '', pinnedTabId: null, pinnedUrl: '' })
    }
    saveChats(allChats.value)
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
    canStop: computed(() => Boolean(abortCurrent.value)),
    send, stop, clear, newChat, switchChat, deleteChat, copyMessage, setProvider,
    setCapabilities,
  }
}
