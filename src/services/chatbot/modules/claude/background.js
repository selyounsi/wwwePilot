export const types = ['CLAUDE_CHAT', 'CLAUDE_KEY_SET', 'CLAUDE_KEY_EXISTS', 'CLAUDE_KEY_DELETE', 'CLAUDE_KEY_VALIDATE', 'CLAUDE_RUN']

import { CHAT_CONFIG_KEY, FALLBACK_CHAT_CONFIG } from './composables/useMcpConfig.js'

// Request config (endpoint, model, beta header, limits) is owned by the backend
// and mirrored into storage by the sidebar — changing a model must not require
// an extension release. Fallbacks apply only before the first successful fetch.
async function loadChatConfig() {
  try {
    const stored = await chrome.storage.local.get(CHAT_CONFIG_KEY)
    return { ...FALLBACK_CHAT_CONFIG, ...(stored?.[CHAT_CONFIG_KEY] ?? {}) }
  } catch {
    return FALLBACK_CHAT_CONFIG
  }
}

function chatHeaders(apiKey, useMcp, cfg) {
  const headers = {
    'Content-Type':       'application/json',
    'x-api-key':          apiKey,
    'anthropic-version':  '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  if (useMcp && cfg.mcpBetaHeader) headers['anthropic-beta'] = cfg.mcpBetaHeader
  return headers
}

function chatBody({ messages, mcpServers, system, stream, cfg }) {
  const useMcp = mcpServers.length > 0
  const body = {
    model:      cfg.model,
    max_tokens: useMcp ? cfg.maxTokensWithTools : cfg.maxTokens,
    messages,
  }
  if (system) body.system = system
  if (stream) body.stream = true
  if (useMcp) {
    body.mcp_servers = mcpServers
    body.tools       = mcpServers.map(s => ({ type: 'mcp_toolset', mcp_server_name: s.name }))
  }
  return body
}

// MV3 service workers idle out after ~30s. An in-flight fetch does not reliably
// reset that timer, so a long MCP turn can be killed mid-stream — this ping
// keeps the worker alive for the duration of the request only.
function startKeepAlive() {
  const timer = setInterval(() => { chrome.runtime.getPlatformInfo().catch(() => {}) }, 20_000)
  return () => clearInterval(timer)
}

// Replaying assistant blocks is only safe when every tool call carries parsed
// arguments and a matching result. Anything half-captured is dropped so the next
// request can never be rejected for a malformed tool pair.
function replayableBlocks(blocks) {
  const resultIds = new Set(
    blocks.filter(b => b.type === 'mcp_tool_result').map(b => b.tool_use_id),
  )
  const usable = blocks.every(b =>
    b.type !== 'mcp_tool_use' ||
    (b.input && typeof b.input === 'object' && resultIds.has(b.id)),
  )
  return usable ? blocks : blocks.filter(b => b.type === 'text')
}

// Streams one Messages API turn over an open port, emitting text blocks as they
// complete plus real mcp_tool_use start/end events. Returns the assembled
// assistant content so a pause_turn can be resumed.
async function streamTurn({ port, apiKey, body, signal, cfg }) {
  const res = await fetch(cfg.apiUrl, {
    method:  'POST',
    headers: chatHeaders(apiKey, Boolean(body.mcp_servers), cfg),
    body:    JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  const content   = []        // assembled blocks, for pause_turn resume + history
  const openTools = new Map() // block index → tool name
  const blockAt   = new Map() // block index → the pushed block object
  const jsonBuf   = new Map() // block index → partial input_json_delta string
  let stopReason  = null
  let textBuf     = ''
  let textIndex   = null

  function flushText() {
    if (textBuf.trim()) {
      port.postMessage({ type: 'text', text: textBuf })
      content.push({ type: 'text', text: textBuf })
    }
    textBuf   = ''
    textIndex = null
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue

      let ev
      try { ev = JSON.parse(raw) } catch { continue }

      switch (ev.type) {
        case 'content_block_start': {
          const block = ev.content_block ?? {}
          if (block.type === 'text') {
            textIndex = ev.index
          } else if (block.type === 'mcp_tool_use') {
            // Emit any narration before the tool call so the step reads in order.
            flushText()
            openTools.set(ev.index, block.name)
            // Correlate on the block index: content_block_stop carries only the
            // index, so keying on block.id here would never match the end event.
            port.postMessage({ type: 'tool_start', name: block.name, toolId: `idx-${ev.index}` })
            const copy = { ...block }
            blockAt.set(ev.index, copy)
            content.push(copy)
          } else {
            content.push(block)
          }
          break
        }
        case 'content_block_delta': {
          const delta = ev.delta ?? {}
          if (delta.type === 'text_delta' && ev.index === textIndex) textBuf += delta.text ?? ''
          // Tool arguments arrive as partial JSON — without stitching them back
          // together the replayed tool_use block would carry an empty input.
          if (delta.type === 'input_json_delta') {
            jsonBuf.set(ev.index, (jsonBuf.get(ev.index) ?? '') + (delta.partial_json ?? ''))
          }
          break
        }
        case 'content_block_stop': {
          if (ev.index === textIndex) flushText()
          const raw = jsonBuf.get(ev.index)
          if (raw !== undefined) {
            const target = blockAt.get(ev.index)
            if (target) {
              try { target.input = JSON.parse(raw) } catch { target.input = null }
            }
            jsonBuf.delete(ev.index)
          }
          const toolName = openTools.get(ev.index)
          if (toolName) {
            port.postMessage({ type: 'tool_end', name: toolName, toolId: `idx-${ev.index}` })
            openTools.delete(ev.index)
          }
          break
        }
        case 'message_delta':
          stopReason = ev.delta?.stop_reason ?? stopReason
          break
      }
    }
  }

  flushText()
  for (const [index, name] of openTools) {
    port.postMessage({ type: 'tool_end', name, toolId: `idx-${index}`, isError: true })
  }

  return { content, stopReason }
}

// Port transport: one connection per chat turn. Needed because
// chrome.runtime.sendMessage can only answer once — status events require a
// channel that stays open.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'claude-chat') return

  const abort = new AbortController()
  let closed  = false
  port.onDisconnect.addListener(() => { closed = true; abort.abort() })

  port.onMessage.addListener(async (msg) => {
    // Explicit stop from the UI: same abort path as a closing panel, but the
    // partial answer already streamed stays on screen.
    if (msg?.type === 'ABORT') {
      abort.abort()
      if (!closed) { try { port.disconnect() } catch {} }
      return
    }
    if (msg?.type !== 'START') return
    const stopKeepAlive = startKeepAlive()
    try {
      const data   = await chrome.storage.local.get('claude_api_key')
      const apiKey = data.claude_api_key
      if (!apiKey) throw new Error('No API key saved. Please add your Claude API key in settings.')

      const cfg        = await loadChatConfig()
      const mcpServers = Array.isArray(msg.mcpServers) ? msg.mcpServers : []
      const body = chatBody({
        messages:   [...(msg.messages ?? []), { role: 'user', content: msg.currentMessage }],
        mcpServers,
        system:     msg.system,
        stream:     true,
        cfg,
      })

      const maxResumes = Number(cfg.maxResumes) || 0
      const turnBlocks = []   // every assistant block of this turn, tool calls included
      for (let attempt = 0; attempt <= maxResumes; attempt++) {
        const { content, stopReason } = await streamTurn({ port, apiKey, body, signal: abort.signal, cfg })
        turnBlocks.push(...content)
        if (stopReason !== 'pause_turn' || closed) break
        if (attempt === maxResumes) {
          port.postMessage({ type: 'error', error: 'PAUSE_LIMIT' })
          break
        }
        body.messages = [...body.messages, { role: 'assistant', content }]
      }

      // Hand the blocks back so the next turn can replay tool calls and their
      // results — without them the model only sees its own narration.
      if (!closed) port.postMessage({ type: 'done', blocks: replayableBlocks(turnBlocks) })
    } catch (e) {
      if (!closed && e.name !== 'AbortError') port.postMessage({ type: 'error', error: e.message })
    } finally {
      stopKeepAlive()
      if (!closed) { try { port.disconnect() } catch {} }
    }
  })
})

export async function handle(msg, sendResponse) {
  switch (msg.type) {

    case 'CLAUDE_KEY_SET': {
      await chrome.storage.local.set({ claude_api_key: msg.key })
      sendResponse({ ok: true })
      break
    }

    case 'CLAUDE_KEY_EXISTS': {
      const data = await chrome.storage.local.get('claude_api_key')
      sendResponse({ exists: !!data.claude_api_key })
      break
    }

    case 'CLAUDE_KEY_DELETE': {
      await chrome.storage.local.remove('claude_api_key')
      sendResponse({ ok: true })
      break
    }

    case 'CLAUDE_KEY_VALIDATE': {
      let key = msg.key
      if (!key) {
        const data = await chrome.storage.local.get('claude_api_key')
        key = data.claude_api_key
      }
      if (!key) { sendResponse({ ok: false, error: 'No key provided' }); break }
      try {
        const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
          method: 'GET',
          headers: {
            'x-api-key':                                     key,
            'anthropic-version':                             '2023-06-01',
            'anthropic-dangerous-direct-browser-access':     'true',
          },
        })
        if (res.ok) {
          sendResponse({ ok: true })
        } else {
          const data = await res.json().catch(() => ({}))
          sendResponse({ ok: false, error: data.error?.message ?? `HTTP ${res.status}` })
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message })
      }
      break
    }

    case 'CLAUDE_RUN': {
      const data = await chrome.storage.local.get('claude_api_key')
      const apiKey = data.claude_api_key
      if (!apiKey) { sendResponse({ error: 'No API key saved' }); break }
      try {
        const cfg = await loadChatConfig()
        const res = await fetch(cfg.apiUrl, {
          method: 'POST',
          headers: chatHeaders(apiKey, false, cfg),
          body: JSON.stringify({
            model:      msg.model      ?? cfg.model,
            max_tokens: msg.max_tokens ?? cfg.maxTokens,
            system:     msg.system,
            messages:   msg.messages,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          sendResponse({ error: err.error?.message ?? `HTTP ${res.status}` })
          break
        }
        const body = await res.json()
        sendResponse({ content: body.content, raw: body })
      } catch (e) {
        sendResponse({ error: e.message })
      }
      break
    }

    case 'CLAUDE_CHAT': {
      const data = await chrome.storage.local.get('claude_api_key')
      const apiKey = data.claude_api_key
      if (!apiKey) {
        sendResponse({ error: 'No API key saved. Please add your Claude API key in settings.' })
        break
      }

      const cfg        = await loadChatConfig()
      const mcpServers = Array.isArray(msg.mcpServers) ? msg.mcpServers : []
      const headers    = chatHeaders(apiKey, mcpServers.length > 0, cfg)
      const body = chatBody({
        messages:   [...(msg.messages ?? []), { role: 'user', content: msg.currentMessage }],
        mcpServers,
        system:     msg.system,
        stream:     false,
        cfg,
      })

      try {
        const textParts = []
        const toolsUsed = []

        // Server-side MCP loops can stop with pause_turn; re-send with the
        // assistant turn appended so the API resumes where it left off.
        const maxAttempts = (Number(cfg.maxResumes) || 0) + 1
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const res = await fetch(cfg.apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            sendResponse({ error: errData.error?.message ?? `HTTP ${res.status}` })
            return
          }

          const result = await res.json()
          for (const block of result.content ?? []) {
            if (block.type === 'text' && block.text) textParts.push(block.text)
            if (block.type === 'mcp_tool_use' && !toolsUsed.includes(block.name)) toolsUsed.push(block.name)
          }

          if (result.stop_reason !== 'pause_turn') break
          body.messages = [...body.messages, { role: 'assistant', content: result.content }]
        }

        sendResponse({ reply: textParts.join('\n\n') || 'No response received.', toolsUsed })
      } catch (e) {
        sendResponse({ error: e.message })
      }
      break
    }
  }
}
