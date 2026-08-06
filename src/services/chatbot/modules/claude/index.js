import { getChatConfig } from './composables/useMcpConfig.js'
import { useModuleSettings, whenModuleSettingsHydrated } from '@/composables/settings/useModuleSettings.js'
import { getActiveTab } from '@/composables/useActiveTab.js'
import { useI18n } from '@/composables/i18n/useI18n.js'

export const accentColor = '#D97757'

export const welcomeText = "Ask me a question — I'm Claude from Anthropic."

export const suggestions = [
  'Explain this element on the page.',
  'How can I improve accessibility?',
  'What do these SEO errors mean?',
]

// Shown instead of the page-oriented starters once CMS4 tools are enabled.
export const cmsSuggestions = [
  'Which pages does this website have?',
  'Check the headings on the current page.',
  'Show me the meta description of this page.',
]

// MCP tools address a site by domain, not by tab — the resolved host has to
// reach the model via the system prompt. Prompt text comes from the backend.
// The host pinned when tools were enabled wins over the live tab, so switching
// tabs mid-conversation can never retarget an edit to another website.
async function resolveTarget(capabilities) {
  if (capabilities?.pinnedHost) return capabilities.pinnedHost
  if ((capabilities?.target ?? 'activeTab') === 'activeTab') return (await getActiveTab()).host
  return ''
}

function streamViaPort({ messages, currentMessage, mcpServers, system, onEvent, onAbortReady }) {
  return new Promise((resolve) => {
    let port
    try {
      port = chrome.runtime.connect({ name: 'claude-chat' })
    } catch (e) {
      resolve({ error: e.message, transportFailed: true })
      return
    }

    let settled  = false
    let sawEvent = false
    let aborted  = false
    const finish = (result) => { if (!settled) { settled = true; resolve(result) } }

    // Hand a stop function to the caller for as long as this turn runs.
    onAbortReady?.(() => {
      aborted = true
      try { port.postMessage({ type: 'ABORT' }) } catch {}
      finish({ streamed: true, aborted: true })
    })

    port.onMessage.addListener((ev) => {
      if (ev?.type === 'error') { finish({ error: ev.error }); try { port.disconnect() } catch {} ; return }
      if (ev?.type === 'done')  { finish({ streamed: true, blocks: ev.blocks }); return }
      sawEvent = true
      onEvent?.(ev)
    })

    // Disconnect without done/error means the worker died or the panel closed.
    // Only report a transport failure if nothing streamed yet, so the caller
    // can retry over the non-streaming path.
    port.onDisconnect.addListener(() => {
      if (aborted) { finish({ streamed: true, aborted: true }); return }
      finish(sawEvent
        ? { streamed: true }
        : { error: 'Connection to the extension worker was lost.', transportFailed: true })
    })

    port.postMessage({ type: 'START', messages, currentMessage, mcpServers, system })
  })
}

function sendViaMessage({ messages, currentMessage, mcpServers, system }) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'CLAUDE_CHAT', messages, currentMessage, mcpServers, system },
      (res) => {
        if (res?.error) resolve({ error: res.error })
        else            resolve({ reply: res?.reply, toolsUsed: res?.toolsUsed })
      },
    )
  })
}

export default async function send({ text, history, capabilities, onEvent, onAbortReady }) {
  await whenModuleSettingsHydrated()
  const settings = useModuleSettings('claude', { cmsToolsEnabled: true })

  // Global setting is the master switch; the per-chat capability decides
  // whether this conversation actually gets the tools.
  const wantsCms = settings.cmsToolsEnabled && capabilities?.cms4 === true

  const { servers, chat, authError } = await getChatConfig()

  // Failing loudly beats a silent plain-text answer: the user explicitly asked
  // for CMS tools, so a missing session or missing config must be visible.
  if (wantsCms && authError) {
    const { t } = useI18n()
    return { error: t('Session expired — please sign in again so the CMS tools can be used.') }
  }
  if (wantsCms && !servers.length) {
    const { t } = useI18n()
    return { error: t('No CMS tools are configured for your account. Ask an admin to set up the CMS4 MCP server.') }
  }

  const mcpServers = wantsCms ? servers : []

  let system
  if (mcpServers.length) {
    const host = await resolveTarget(capabilities)
    system = host
      ? (chat.systemPrompt ?? '').replace('{host}', host)
      : chat.systemPromptNoTarget
  }

  const payload = { messages: history, currentMessage: text, mcpServers, system, onEvent, onAbortReady }
  const streamed = await streamViaPort(payload)
  if (!streamed.transportFailed) {
    if (streamed.error) {
      const { t } = useI18n()
      return {
        error: streamed.error === 'PAUSE_LIMIT'
          ? t('The task needed too many steps. Please ask again, more specifically.')
          : streamed.error,
      }
    }
    return { reply: '', blocks: streamed.blocks, aborted: streamed.aborted }
  }

  const res = await sendViaMessage(payload)
  if (res.error) return { error: res.error }
  let reply = res.reply
  if (res.toolsUsed?.length) reply += `\n\n*${res.toolsUsed.join(', ')}*`
  return { reply }
}
