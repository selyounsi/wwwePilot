import { API } from '@/config/api.js'
import { apiFetch } from '@/composables/auth/apiClient.js'

export const accentColor = 'var(--color-primary)'

export const welcomeText = 'Ask me about the Working Guide or project types.'

export const suggestions = [
  'What different project types are there?',
  'How does a typical project work?',
  'What are the most important quality standards?',
]

export default async function send({ text, history, chatId }) {
  try {
    const res = await apiFetch(API.chatbot.url, {
      method: 'POST',
      body: JSON.stringify({
        systemPrompt:   '',
        messages:       history,
        currentMessage: text,
        chatInput:      text,
        chat_id:        chatId,
        message_id:     crypto.randomUUID(),
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data  = await res.json()
    const reply = Array.isArray(data)
      ? data[0]?.output ?? data[0]?.text ?? data[0]?.message ?? JSON.stringify(data[0])
      : data?.output    ?? data?.text    ?? data?.message    ?? JSON.stringify(data)
    return { reply }
  } catch (e) {
    return { error: e.message }
  }
}
