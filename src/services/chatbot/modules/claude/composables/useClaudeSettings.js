import { ref } from 'vue'

const keyExists = ref(false)

chrome.runtime.sendMessage({ type: 'CLAUDE_KEY_EXISTS' }, (res) => {
  keyExists.value = res?.exists ?? false
})

export function useClaudeSettings() {
  function saveKey(key) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CLAUDE_KEY_SET', key }, (res) => {
        keyExists.value = true
        resolve(res)
      })
    })
  }

  function deleteKey() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CLAUDE_KEY_DELETE' }, (res) => {
        keyExists.value = false
        resolve(res)
      })
    })
  }

  return { keyExists, saveKey, deleteKey }
}
