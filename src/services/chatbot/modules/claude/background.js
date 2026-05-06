export const types = ['CLAUDE_CHAT', 'CLAUDE_KEY_SET', 'CLAUDE_KEY_EXISTS', 'CLAUDE_KEY_DELETE', 'CLAUDE_KEY_VALIDATE', 'CLAUDE_RUN']

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
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type':                              'application/json',
            'x-api-key':                                 apiKey,
            'anthropic-version':                         '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model:      msg.model      ?? 'claude-sonnet-4-6',
            max_tokens: msg.max_tokens ?? 1024,
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

      const messages = [
        ...(msg.messages ?? []),
        { role: 'user', content: msg.currentMessage },
      ]

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':       'application/json',
          'x-api-key':          apiKey,
          'anthropic-version':  '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          messages,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        sendResponse({ error: errData.error?.message ?? `HTTP ${res.status}` })
        break
      }

      const result = await res.json()
      const reply  = result.content?.[0]?.text ?? 'No response received.'
      sendResponse({ reply })
      break
    }
  }
}
