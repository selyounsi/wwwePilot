<script setup>
import { computed, ref } from 'vue'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useCheckStore } from '@/services/web-checker/composables/useCheckStore.js'
import { useClaude }     from '@/services/chatbot/modules/claude/composables/useClaude.js'
import ClaudeButton      from '@/services/chatbot/modules/claude/components/ClaudeButton.vue'
import ClaudeResult      from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'

const props = defineProps({ result: Object })

const { t }      = useI18n()
const checkStore = useCheckStore()
const claude     = useClaude()

const counts = computed(() => [1, 2, 3, 4, 5, 6].map(level => ({
  tag:   `H${level}`,
  count: props.result?.items?.filter(i => i.level === level).length ?? 0,
})))

const h1Items = computed(() => props.result?.items?.filter(i => i.level === 1) ?? [])

const h1Open    = ref(false)
const h1Loading = ref(false)
const h1Text    = ref('')
const h1Error   = ref('')

async function fetchPageContext() {
  const tabId = checkStore.state.checkedTabId
  if (!tabId) return null
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title:    document.title || '',
        url:      location.href,
        h1:       document.querySelector('h1')?.innerText?.trim() || '',
        bodyText: (document.querySelector('main')?.innerText || document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 3000),
      }),
    })
    return result
  } catch {
    return null
  }
}

async function generateH1() {
  h1Open.value    = true
  h1Text.value    = ''
  h1Error.value   = ''
  h1Loading.value = true
  try {
    const ctx = await fetchPageContext()
    if (!ctx) throw new Error('Could not read the page content. Reopen the page and try again.')

    const currentH1 = h1Items.value[0]?.text?.trim() || ctx.h1 || ''

    const userMessage = [
      `URL: ${ctx.url}`,
      ctx.title ? `Page title: ${ctx.title}` : null,
      currentH1 ? `Current H1: "${currentH1}"` : 'No H1 on the page yet.',
      '',
      'Page text:',
      ctx.bodyText || '(empty)',
    ].filter(Boolean).join('\n')

    const result = await claude.run({
      max_tokens: 100,
      system: 'Du schreibst die H1-Überschrift einer Webseite auf Deutsch. ' +
              'Gib NUR die H1 zurück — keine Erklärungen, keine Anführungszeichen. ' +
              '20–70 Zeichen. Hauptkeyword voran, klares Thema, aktive Sprache. ' +
              'Keine generischen Floskeln wie "Willkommen" oder "Über uns".',
      messages: [{ role: 'user', content: userMessage }],
    })
    h1Text.value = result.text.trim().replace(/^["']|["']$/g, '')
  } catch (e) {
    h1Error.value = e.message || String(e)
  } finally {
    h1Loading.value = false
  }
}

const generatorLabel = computed(() =>
  h1Items.value.length === 0
    ? t('Generate missing H1')
    : t('Improve H1')
)
</script>

<template>
  <div class="flex flex-col gap-2 mb-3">
    <div class="grid grid-cols-6 gap-2">
      <div
        v-for="c in counts" :key="c.tag"
        class="bg-surface-soft border border-border rounded-xl p-2 text-center"
      >
        <p class="text-xs text-muted">{{ c.tag }}</p>
        <p class="text-lg font-bold mt-0.5" :class="c.count === 0 ? 'text-muted/30' : 'text-light'">
          {{ c.count }}
        </p>
      </div>
    </div>

    <ClaudeButton
      variant="pill"
      :size="13"
      :label="generatorLabel"
      :loading="h1Loading"
      @click="generateH1"
    />

    <ClaudeResult
      :open="h1Open"
      :title="t('Suggested H1')"
      :loading="h1Loading"
      :error="h1Error"
      :text="h1Text"
      @update:open="h1Open = $event"
    />
  </div>
</template>
