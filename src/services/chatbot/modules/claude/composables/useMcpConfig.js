import { apiJson } from '@/composables/auth/apiClient.js'
import { API } from '@/config/api.js'

export const CHAT_CONFIG_KEY = 'claude_chat_config'

// Last-resort values only. The backend (/api/config/mcp) is authoritative so
// model, endpoint, beta header and prompts can change without an extension
// release; these apply when the user is offline or not logged in yet.
export const FALLBACK_CHAT_CONFIG = {
  apiUrl:               'https://api.anthropic.com/v1/messages',
  model:                'claude-sonnet-4-6',
  mcpBetaHeader:        'mcp-client-2025-11-20',
  maxTokens:            1024,
  maxTokensWithTools:   4096,
  maxResumes:           5,
  systemPrompt:         'The user is working on the website "{host}". Use it whenever a CMS tool needs a website/domain.',
  systemPromptNoTarget: 'No target website could be determined — ask the user which website to work on before calling CMS tools.',
}

// Drops empty strings / non-positive numbers so a partially-configured backend
// can't blank out a working default.
function mergeChatConfig(remote) {
  const out = { ...FALLBACK_CHAT_CONFIG }
  for (const [key, value] of Object.entries(remote ?? {})) {
    if (typeof value === 'string' && value.trim())      out[key] = value
    else if (typeof value === 'number' && value > 0)    out[key] = value
  }
  return out
}

// Servers carry a bearer token → in-memory only, never persisted.
let serverCache = null
let inflight = null

/**
 * Fetches MCP servers + chat request config. The chat block is mirrored into
 * chrome.storage.local so the service worker can read it after a restart
 * (it holds no secrets); servers stay in memory for this panel session.
 */
export async function getChatConfig() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const data    = await apiJson(`${API.config.url}/mcp`)
      const servers = Array.isArray(data?.servers) ? data.servers : []
      const chat    = mergeChatConfig(data?.chat)
      if (servers.length) serverCache = servers
      try { await chrome.storage.local.set({ [CHAT_CONFIG_KEY]: chat }) } catch {}
      return { servers, chat, authError: false }
    } catch (e) {
      console.warn('[claude/config] fetch failed:', e.message)
      // apiFetch already tried a token refresh; a surviving 401 means the
      // refresh token is gone too, so the user has to sign in again. Report it
      // instead of silently dropping the tools.
      return {
        servers:   serverCache ?? [],
        chat:      FALLBACK_CHAT_CONFIG,
        authError: e.status === 401,
      }
    } finally {
      inflight = null
    }
  })()
  return inflight
}
