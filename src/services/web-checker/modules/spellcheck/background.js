import { API } from '@/config/api.js'

export const types = [
  'CHECK_SPELLING',
  'SPELL_DICT_ADD',
  'SPELL_DICT_DELETE',
  'SPELL_IGNORE_ADD',
]

export async function handle(msg, sendResponse) {
  const base = API.spellcheck.url
  const hdr  = () => ({ 'Content-Type': 'application/json' })

  try {
    let res

    if (msg.type === 'CHECK_SPELLING') {
      res = await fetch(`${base}/check`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({
          text:     msg.text,
          language: msg.language ?? 'de-DE',
          domain:   msg.domain   ?? undefined,
          images:   msg.images?.length ? msg.images : undefined,
        }),
      })
    } else if (msg.type === 'SPELL_DICT_ADD') {
      res = await fetch(`${base}/dictionary`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ domain: msg.domain, word: msg.word }),
      })
    } else if (msg.type === 'SPELL_DICT_DELETE') {
      res = await fetch(`${base}/dictionary/${msg.id}`, {
        method: 'DELETE', headers: hdr(),
      })
    } else if (msg.type === 'SPELL_IGNORE_ADD') {
      res = await fetch(`${base}/ignored`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ domain: msg.domain, error_text: msg.error_text }),
      })
    }

    sendResponse(await res.json())
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
