<script setup>
import { computed, ref } from 'vue'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useCheckStore } from '@/services/web-checker/composables/useCheckStore.js'
import { useClaude }     from '@/services/chatbot/modules/claude/composables/useClaude.js'
import ClaudeButton      from '@/services/chatbot/modules/claude/components/ClaudeButton.vue'
import ClaudeResult      from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'
import { APP_NAME_LOWER } from '@/config/app.js'

const props = defineProps({ item: Object })

const { t }      = useI18n()
const checkStore = useCheckStore()
const claude     = useClaude()

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.name,
  details: props.item.provider || props.item.host || '',
}))

const hasIssue = computed(() =>
  (props.item.issues ?? []).some(i => i.type === 'error' || i.type === 'warning')
)

const fixOpen    = ref(false)
const fixLoading = ref(false)
const fixText    = ref('')
const fixError   = ref('')

async function fetchElementSnapshot() {
  const tabId = checkStore.state.checkedTabId
  const elementId = props.item.element
  if (!tabId || !elementId) return null
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (id, prefix) => {
        const el = document.querySelector(`[data-${prefix}-id="${id}"]`)
        if (!el) return null
        const clone = el.cloneNode(true)
        ;[`data-${prefix}-id`, `data-${prefix}-module`, `data-${prefix}-type`,
          `data-${prefix}-meta`, `data-${prefix}-title`, `data-${prefix}-desc`,
          `data-${prefix}-injected`, `data-${prefix}-highlight`,
        ].forEach(a => {
          const visit = (n) => {
            if (n.nodeType !== 1) return
            n.removeAttribute(a)
            for (const c of Array.from(n.children)) visit(c)
          }
          visit(clone)
        })
        const html = clone.outerHTML
        const parentTag = el.parentElement?.tagName?.toLowerCase() || ''
        const inHead    = !!el.closest('head')
        const inBody    = !!el.closest('body')
        const isLastInBody = inBody && el.parentElement?.tagName?.toLowerCase() === 'body'
          && el.parentElement.children[el.parentElement.children.length - 1] === el
        return { html: html.length > 1500 ? html.slice(0, 1500) + '…' : html, parentTag, inHead, inBody, isLastInBody }
      },
      args: [elementId, APP_NAME_LOWER],
    })
    return result
  } catch {
    return null
  }
}

async function generateFix() {
  fixOpen.value    = true
  fixText.value    = ''
  fixError.value   = ''
  fixLoading.value = true
  try {
    const snap   = await fetchElementSnapshot()
    const issues = (props.item.issues ?? []).filter(i => i.type !== 'success')
    const url    = checkStore.state.checkedUrl ?? ''

    const placement = snap
      ? snap.inHead ? 'im <head>'
        : snap.isLastInBody ? 'am Ende von <body>'
        : snap.inBody ? `innerhalb <${snap.parentTag}> in <body>` : 'unbekannt'
      : 'unbekannt'

    const userMessage = [
      url ? `Page URL: ${url}` : null,
      `Service: ${props.item.serviceName || props.item.service || 'unbekannt'}`,
      `Provider: ${props.item.provider || '—'}`,
      `Host: ${props.item.host || '—'}`,
      `Kind: ${props.item.kind || '—'}`,
      `Aktueller Placement: ${placement}`,
      `Im DSGVO-Consent maskiert?: ${props.item.masked ? 'ja (data-* Wrapper)' : 'nein (lädt unkonditional)'}`,
      `Aktuelles Consent: ${props.item.consent === true ? 'erteilt' : props.item.consent === false ? 'nicht erteilt' : 'unbekannt'}`,
      '',
      'Gefundene Probleme:',
      ...issues.map(i => `- [${i.type}] ${i.message}`),
      '',
      snap?.html ? `Element HTML:\n\`\`\`html\n${snap.html}\n\`\`\`` : null,
    ].filter(Boolean).join('\n')

    const result = await claude.run({
      max_tokens: 900,
      system: 'Du bist DSGVO- und Web-Tracking-Experte. Du bekommst Daten über ein erkanntes Tracking-Element ' +
              '(Google Tag Manager, Google Analytics, Meta Pixel, etc.) auf einer Webseite. ' +
              'Antworte auf Deutsch in genau dieser Struktur (Markdown):\n\n' +
              '**Problem in einem Satz:** Was ist DSGVO- oder Consent-Mode-technisch falsch?\n\n' +
              '**Korrigiertes Snippet:** Wenn das Placement (z.B. GTM/gtag muss in den `<head>` für Consent Mode v2) oder die Lade-Reihenfolge falsch ist, gib das korrekt platzierte HTML-Snippet in einem ```html-Block zurück (mit kurzem Kommentar wo es hin gehört).\n\n' +
              '**Cookie-Banner-Text:** 1-2 Sätze für den Consent-Banner, die genau diesen Dienst erwähnen, in nutzerfreundlichem Deutsch (Anrede „Wir").\n\n' +
              '**Datenschutzerklärungs-Snippet:** 3-4 Sätze, die du in die DSE kopieren kannst — was der Dienst tut, welche Daten verarbeitet werden, Rechtsgrundlage (typisch Art. 6 Abs. 1 lit. a DSGVO bei Consent), Widerruf-Hinweis. Keine Floskeln, kein Marketing-Sprech.\n\n' +
              'Wenn der Dienst NICHT erkennbar / unkritisch ist, sag es kurz und überspringe die Snippets.',
      messages: [{ role: 'user', content: userMessage }],
    })
    fixText.value = result.text.trim()
  } catch (e) {
    fixError.value = e.message || String(e)
  } finally {
    fixLoading.value = false
  }
}
</script>

<template>
  <div>
    <ModuleItem :item="normalized" variant="list">
      <template v-if="hasIssue" #leading-actions>
        <ClaudeButton
          icon-only
          :label="t('Generate DSGVO fix')"
          :loading="fixLoading"
          @click.stop="generateFix"
        />
      </template>
    </ModuleItem>

    <ClaudeResult
      :open="fixOpen"
      :title="t('DSGVO fix + cookie banner + DSE snippet')"
      :loading="fixLoading"
      :error="fixError"
      :text="fixText"
      @update:open="fixOpen = $event"
    />
  </div>
</template>
