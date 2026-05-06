<script setup>
import { computed, ref } from 'vue'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useCheckStore } from '@/services/web-checker/composables/useCheckStore.js'
import { useClaude }     from '@/services/chatbot/modules/claude/composables/useClaude.js'
import ClaudeButton      from '@/services/chatbot/modules/claude/components/ClaudeButton.vue'
import ClaudeResult      from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'

const props = defineProps({ item: Object })

const { t }      = useI18n()
const checkStore = useCheckStore()
const claude     = useClaude()

const normalized = computed(() => ({
  ...props.item,
  title: props.item.name,
}))

const isMetaDesc = computed(() =>
  props.item.id === 'meta-desc'
  && (props.item.issues ?? []).some(i => i.type !== 'success')
)

const descOpen    = ref(false)
const descLoading = ref(false)
const descText    = ref('')
const descError   = ref('')

async function fetchPageContext() {
  const tabId = checkStore.state.checkedTabId
  if (!tabId) return null
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title:        document.title || '',
        url:          location.href,
        currentDesc:  document.querySelector('meta[name="description"]')?.content || '',
        h1:           document.querySelector('h1')?.innerText?.trim() || '',
        bodyText:    (document.querySelector('main')?.innerText || document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 3000),
      }),
    })
    return result
  } catch {
    return null
  }
}

async function generateMetaDesc() {
  descOpen.value    = true
  descText.value    = ''
  descError.value   = ''
  descLoading.value = true
  try {
    const ctx = await fetchPageContext()
    if (!ctx) throw new Error('Could not read the page content. Reopen the page and try again.')

    const userMessage = [
      `URL: ${ctx.url}`,
      `Page title: ${ctx.title}`,
      ctx.h1 ? `H1: ${ctx.h1}` : null,
      ctx.currentDesc ? `Current meta description: "${ctx.currentDesc}"` : 'No meta description set.',
      '',
      'Page text:',
      ctx.bodyText || '(empty)',
    ].filter(Boolean).join('\n')

    const result = await claude.run({
      max_tokens: 220,
      system: 'Du schreibst SEO-Meta-Descriptions auf Deutsch. ' +
              'Gib NUR den Description-Text zurück — keine Erklärungen, keine Anführungszeichen. ' +
              'Genau 120–160 Zeichen. Aktive Sprache, ein konkreter Nutzen, ein Call-to-Action wenn passend. ' +
              'Keine Floskeln wie "Willkommen", kein Marketing-Sprech.',
      messages: [{ role: 'user', content: userMessage }],
    })
    descText.value = result.text.trim().replace(/^["']|["']$/g, '')
  } catch (e) {
    descError.value = e.message || String(e)
  } finally {
    descLoading.value = false
  }
}
</script>

<template>
  <div>
    <ModuleItem :item="normalized" variant="box">
      <template v-if="isMetaDesc" #expand>
        <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">
          <div
            v-for="issue in item.issues"
            :key="issue.message"
            class="text-xs"
            :class="issue.type === 'error' ? 'text-error' : issue.type === 'warning' ? 'text-alert' : 'text-success'"
          >{{ issue.message }}</div>

          <ClaudeButton
            variant="pill"
            :size="13"
            :label="t('Generate description')"
            :loading="descLoading"
            @click="generateMetaDesc"
          />
        </div>
      </template>
    </ModuleItem>

    <ClaudeResult
      :open="descOpen"
      :title="t('Suggested meta description')"
      :loading="descLoading"
      :error="descError"
      :text="descText"
      @update:open="descOpen = $event"
    />
  </div>
</template>
