import { API } from '@/config/api.js'
import { apiFetch } from '@/composables/auth/apiClient.js'

export const types = [
  'CHECK_SPELLING',
  'SPELL_DICT_ADD',
  'SPELL_DICT_DELETE',
  'SPELL_IGNORE_ADD',
]

export async function handle(msg, sendResponse) {
  const base = API.spellcheck.url

  try {
    let res

    if (msg.type === 'CHECK_SPELLING') {
      res = await apiFetch(`${base}/check`, {
        method: 'POST',
        body: JSON.stringify({
          text:     msg.text,
          url:      msg.url      ?? undefined,
          language: msg.language ?? 'de-DE',
          domain:   msg.domain   ?? undefined,
          images:   msg.images?.length ? msg.images : undefined,
        }),
      })
    } else if (msg.type === 'SPELL_DICT_ADD') {
      res = await apiFetch(`${base}/dictionary`, {
        method: 'POST',
        body: JSON.stringify({ domain: msg.domain, word: msg.word }),
      })
    } else if (msg.type === 'SPELL_DICT_DELETE') {
      res = await apiFetch(`${base}/dictionary/${msg.id}`, {
        method: 'DELETE',
      })
    } else if (msg.type === 'SPELL_IGNORE_ADD') {
      res = await apiFetch(`${base}/ignored`, {
        method: 'POST',
        body: JSON.stringify({ domain: msg.domain, error_text: msg.error_text }),
      })
    }

    sendResponse(await res.json())
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
