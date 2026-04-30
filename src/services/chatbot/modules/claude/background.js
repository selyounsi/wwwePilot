export const types = ['CLAUDE_CHAT', 'CLAUDE_KEY_SET', 'CLAUDE_KEY_EXISTS', 'CLAUDE_KEY_DELETE']

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
