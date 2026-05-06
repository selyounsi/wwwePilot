import { ref } from 'vue'

const keyExists = ref(false)

chrome.runtime.sendMessage({ type: 'CLAUDE_KEY_EXISTS' }, (res) => {
  keyExists.value = res?.exists ?? false
})

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve))
}

export function useClaudeSettings() {
  async function saveKey(key) {
    const res = await send({ type: 'CLAUDE_KEY_SET', key })
    keyExists.value = true
    return res
  }

  async function deleteKey() {
    const res = await send({ type: 'CLAUDE_KEY_DELETE' })
    keyExists.value = false
    return res
  }

  /** Pings Anthropic /v1/models with the given key, or the stored one if omitted. */
  function validateKey(key) {
    return send({ type: 'CLAUDE_KEY_VALIDATE', key })
  }

  return { keyExists, saveKey, deleteKey, validateKey }
}
