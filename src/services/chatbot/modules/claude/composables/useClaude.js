import { ref, computed, watch } from 'vue'
import { useClaudeSettings }     from './useClaudeSettings.js'
import { useChatbotProviders }   from '../../../composables/useChatbotProviders.js'

const lastValidated = ref(false)
let inflightValidation = null
let eagerWatcherSetup = false

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve))
}

// `isAvailable` is true only when provider enabled, key saved and validated
export function useClaude() {
  const { keyExists, validateKey } = useClaudeSettings()
  const { isEnabled }              = useChatbotProviders()

  const isEnabledByUser = computed(() => isEnabled('claude'))
  const isAvailable     = computed(() =>
    isEnabledByUser.value && keyExists.value && lastValidated.value
  )

  async function ensureValidated() {
    if (lastValidated.value)  return true
    if (!keyExists.value)     return false
    if (inflightValidation)   return inflightValidation
    inflightValidation = (async () => {
      try {
        const res = await validateKey()
        lastValidated.value = !!res?.ok
        return lastValidated.value
      } finally {
        inflightValidation = null
      }
    })()
    return inflightValidation
  }

  function invalidate() {
    lastValidated.value = false
  }

  // eager validate so `isAvailable` flips without requiring a user click
  if (!eagerWatcherSetup) {
    eagerWatcherSetup = true
    watch(
      () => isEnabledByUser.value && keyExists.value,
      (ready) => {
        if (ready && !lastValidated.value) ensureValidated().catch(() => {})
        if (!ready) lastValidated.value = false
      },
      { immediate: true },
    )
  }

  async function run({ system, messages, model, max_tokens } = {}) {
    if (!isAvailable.value) {
      const ok = await ensureValidated()
      if (!ok) throw new Error('Claude is not available')
    }
    const res = await send({ type: 'CLAUDE_RUN', system, messages, model, max_tokens })
    if (res?.error) {
      if (/api[_\s-]?key|auth/i.test(res.error)) invalidate()
      throw new Error(res.error)
    }
    const text = res?.content?.find(c => c.type === 'text')?.text
    if (!text) throw new Error('No text response')
    return { text, raw: res.raw }
  }

  return { isAvailable, isEnabledByUser, lastValidated, ensureValidated, invalidate, run }
}
