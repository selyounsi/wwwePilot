import { ref, onMounted, onUnmounted } from 'vue'

const tabId  = ref(null)
const tabUrl = ref('')
let listenerCount = 0

async function refresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId.value  = tab?.id ?? null
    tabUrl.value = tab?.url ?? ''
  } catch {
    tabId.value = null
    tabUrl.value = ''
  }
}

function onActivated()             { refresh() }
function onUpdated(_id, info, tab) { if (tab?.active && info.url) refresh() }

export function useActiveTab() {
  onMounted(() => {
    if (listenerCount === 0) {
      chrome.tabs.onActivated.addListener(onActivated)
      chrome.tabs.onUpdated.addListener(onUpdated)
    }
    listenerCount++
    refresh()
  })
  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  })
  return { tabId, tabUrl }
}
