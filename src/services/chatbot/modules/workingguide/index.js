import { API } from '@/config/api.js'
import { apiFetch } from '@/composables/auth/apiClient.js'
import { useI18n } from '@/composables/i18n/useI18n.js'

export const accentColor = 'var(--color-primary)'

export const welcomeText = 'Ask me about the Working Guide or project types.'

export const suggestions = [
  'What different project types are there?',
  'How does a typical project work?',
  'What are the most important quality standards?',
]

// The backend proxy answers 502 both when n8n is down and when it is
// unreachable — for the user that is the same situation.
function friendlyError(t, status) {
  if (status === 502 || status === 503 || status === 504) {
    return t('The WorkingGuide service is currently unavailable. Please try again in a moment.')
  }
  if (status === 401 || status === 403) {
    return t('Your session has expired. Please sign in again.')
  }
  return t('The request failed (HTTP {status}). Please try again.', { status })
}

export default async function send({ text, history, chatId }) {
  const { t } = useI18n()
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
    if (!res.ok) return { error: friendlyError(t, res.status) }

    const data  = await res.json()
    const reply = Array.isArray(data)
      ? data[0]?.output ?? data[0]?.text ?? data[0]?.message ?? JSON.stringify(data[0])
      : data?.output    ?? data?.text    ?? data?.message    ?? JSON.stringify(data)
    return { reply }
  } catch {
    return { error: t('The WorkingGuide service could not be reached. Check your connection and try again.') }
  }
}
