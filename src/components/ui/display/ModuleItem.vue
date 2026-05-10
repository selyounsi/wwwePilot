<script setup>
import { ref, inject, computed, useSlots } from 'vue'
import { useRouter } from 'vue-router'
import { highlightElement } from '@/composables/highlight/index.js'
import { useChat } from '@/services/chatbot/composables/useChat.js'
import { useChatbotProviders } from '@/services/chatbot/composables/useChatbotProviders.js'
import { useClaude } from '@/services/chatbot/modules/claude/composables/useClaude.js'
import ClaudeButton from '@/services/chatbot/modules/claude/components/ClaudeButton.vue'
import ClaudeResult from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'
import { useCheckStore } from '@/services/web-checker/composables/useCheckStore.js'
import { useIgnoreList } from '@/services/web-checker/composables/useIgnoreList.js'
import { useLiveEditorBridge } from '@/composables/liveEditor/useLiveEditorBridge.js'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { APP_NAME_LOWER } from '@/config/app.js'

const { t } = useI18n()

const props = defineProps({
  item:             { type: Object,  required: true },
  variant:          { type: String,  default: 'box' },
  hideEditorButton: { type: Boolean, default: false },
})
const emit = defineEmits(['click'])

const router       = useRouter()
const { send }     = useChat()
const { anyEnabled: chatEnabled } = useChatbotProviders()
const claude       = useClaude()
const checkStore   = useCheckStore()
const slots        = useSlots()
const open         = ref(false)

const explainOpen    = ref(false)
const explainLoading = ref(false)
const explainText    = ref('')
const explainError   = ref('')

const {
  labelFn      = () => '',
  allowChatBot = false,
  moduleId     = null,
  actions      = {},
  claude: claudeConfig = null,
} = inject('moduleOverlay', {})

const DEFAULT_EXPLAIN_PROMPT =
  'You are a senior web QA engineer helping a developer fix issues found on a web page. ' +
  'Reply in German, concise (3-6 short paragraphs maximum). Explain WHY the issue matters, ' +
  'then give a CONCRETE FIX with code if applicable. No fluff, no apologies.'

const showLiveEditor    = actions.liveEditor    !== false
const showChatbot       = actions.chatbot       !== false && allowChatBot
const showClaudeExplain = actions.claudeExplain !== false
const showIgnore        = actions.ignore        !== false

const { add: addIgnore, remove: removeIgnore, getNote: getIgnoreNote } = useIgnoreList()
const ignoreConfirmOpen = ref(false)
const {
  editorTab,
  focusItem:        focusInLiveEditor,
  requestEditable:  requestLiveEditable,
  getEditable:      getLiveEditable,
} = useLiveEditorBridge()

const isLiveEditable = computed(() => {
  if (!editorTab.value) return false
  requestLiveEditable(props.item)
  return getLiveEditable(props.item) === true
})

async function showInLiveEditor() {
  await focusInLiveEditor(props.item)
}
const origin = computed(() => {
  try { return new URL(checkStore.state.checkedUrl ?? '').origin } catch { return null }
})

function askIgnore() {
  if (!origin.value || !moduleId) return
  ignoreConfirmOpen.value = true
}

function confirmIgnore(note) {
  if (!origin.value || !moduleId) return
  ;(props.item.issues ?? [])
    .filter(i => i.type !== 'success')
    .forEach(i => addIgnore(origin.value, moduleId, i.message, { note }))
}

function unignoreItem() {
  if (!origin.value || !moduleId) return
  ;(props.item.issues ?? [])
    .filter(i => i.type !== 'success')
    .forEach(i => removeIgnore(origin.value, moduleId, i.message))
}

const ignoreNote = computed(() => {
  if (!origin.value || !moduleId || !props.item._ignored) return ''
  const firstIssue = (props.item.issues ?? []).find(i => i.type !== 'success')
  if (!firstIssue) return ''
  return getIgnoreNote(origin.value, moduleId, firstIssue.message)
})

const highlight = (clickType) => {
  highlightElement(props.item, labelFn(props.item), clickType)
  emit('click', clickType)
}

// fetch the element's outerHTML from the page tab and strip extension-added
// attributes so the chatbot sees the original markup.
async function fetchElementHtml() {
  if (!props.item.element) return null
  const tabIds = []
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (active?.id)                            tabIds.push(active.id)
  if (checkStore.state.checkedTabId
      && !tabIds.includes(checkStore.state.checkedTabId)) tabIds.push(checkStore.state.checkedTabId)

  for (const tabId of tabIds) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: (id, prefix) => {
          const el = document.querySelector(`[data-${prefix}-id="${id}"]`)
          if (!el) return null
          const clone = el.cloneNode(true)
          const stripAttrs = [
            `data-${prefix}-id`,    `data-${prefix}-module`, `data-${prefix}-type`,
            `data-${prefix}-meta`,  `data-${prefix}-title`,  `data-${prefix}-desc`,
            `data-${prefix}-injected`, `data-${prefix}-highlight`,
          ]
          const visit = (n) => {
            if (n.nodeType !== 1) return
            stripAttrs.forEach(a => n.removeAttribute(a))
            for (const c of Array.from(n.children)) visit(c)
          }
          visit(clone)
          return clone.outerHTML
        },
        args: [props.item.element, APP_NAME_LOWER],
      })
      const html = results.find(r => r.result)?.result
      if (html) return html
    } catch {}
  }
  return null
}

async function explainWithClaude() {
  explainOpen.value    = true
  explainText.value    = ''
  explainError.value   = ''
  explainLoading.value = true
  try {
    const issues = (props.item.issues ?? []).filter(i => i.type !== 'success')
    const label  = labelFn(props.item) || props.item.title || props.item.text || props.item.name || ''
    const html   = await fetchElementHtml()
    const trimmedHtml = html && html.length > 2000 ? html.slice(0, 2000) + '\n…' : html

    const checkedUrl = checkStore.state.checkedUrl ?? ''
    const issueLines = issues.map(i => `- [${i.type}] ${i.message}`).join('\n')

    const userMessage = [
      `Module: ${moduleId}`,
      checkedUrl && `Page: ${checkedUrl}`,
      `Element: ${label}`,
      issueLines && `Issues:\n${issueLines}`,
      trimmedHtml && `HTML:\n\`\`\`html\n${trimmedHtml}\n\`\`\``,
    ].filter(Boolean).join('\n\n')

    const result = await claude.run({
      max_tokens: claudeConfig?.maxTokens ?? 800,
      system:     claudeConfig?.systemPrompt ?? DEFAULT_EXPLAIN_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })
    explainText.value = result.text
  } catch (e) {
    explainError.value = e.message || String(e)
  } finally {
    explainLoading.value = false
  }
}

async function openInChat() {
  const issues = (props.item.issues ?? []).filter(i => i.type !== 'success')
  const label  = labelFn(props.item) || props.item.title || props.item.text || props.item.name || ''
  const name   = props.item.name || ''
  const hasErrors = issues.some(i => i.type === 'error')
  const typ = hasErrors ? 'Fehler' : 'Warnung'

  const nameInfo = name && name !== label ? `\n**Dateiname:** ${name}` : ''

  const html        = await fetchElementHtml()
  const truncated   = html && html.length > 2000 ? html.slice(0, 2000) + '\n…' : html
  const htmlSection = truncated ? `\n\n**HTML:**\n\`\`\`html\n${truncated}\n\`\`\`` : ''

  const msg = issues.length
    ? `Ich habe folgende ${typ} auf der Seite gefunden:\n\n**Element:** ${label}${nameInfo}\n**Probleme:**\n${issues.map(i => `- [${i.type === 'error' ? 'Fehler' : 'Warnung'}] ${i.message}`).join('\n')}${htmlSection}\n\nWas kann ich dagegen tun?`
    : `Was kannst du mir zu diesem Element sagen?\n\n**Element:** ${label}${nameInfo}${htmlSection}`

  send(msg)
  router.push('/service/chatbot')
}

const title   = computed(() => props.item.title   ?? props.item.text ?? props.item.name ?? props.item.href ?? '')
const details = computed(() => props.item.details ?? props.item.tag  ?? props.item.href ?? '')
const image   = computed(() => props.item.image   ?? props.item.src  ?? '')
const indent  = computed(() => props.item.indent  ?? '')

const status = computed(() =>
  props.item.issues?.some(i => i.type === 'error')   ? 'error'   :
  props.item.issues?.some(i => i.type === 'warning') ? 'warning' :
  'success'
)

const borderColor = { error: 'border-error/80', warning: 'border-alert/50', success: 'border-border' }
const dotColor    = { error: 'bg-error',        warning: 'bg-alert',         success: 'bg-success'   }
</script>

<template>
  <div
    :id="item.element ? `item-${item.element}` : undefined"
    :class="[
      !item.visible ? 'opacity-60' : '',
      item._ignored  ? 'opacity-60' : '',
      indent,
      variant === 'box'
        ? ['rounded-xl border overflow-hidden', borderColor[status]]
        : 'border-b border-border/50 last:border-b-0',
    ]"
  >
    <div
      @click="highlight('click')"
      @dblclick.stop="highlight('dblclick')"
      :class="[
        'flex items-center gap-3 cursor-pointer transition-colors group relative',
        variant === 'box'
          ? 'p-3 hover:bg-surface-soft-hover'
          : 'py-2 px-1 hover:bg-surface-soft-hover/50',
      ]"
    >
      <div v-if="image"
        style="width:64px; height:64px; flex-shrink:0;"
        class="rounded-lg overflow-hidden bg-surface-soft flex items-center justify-center"
      >
        <img
          :src="image"
          :style="`width:64px; height:64px; object-fit:${image.endsWith('.svg') ? 'contain' : 'cover'}; padding:${image.endsWith('.svg') ? '6px' : '0'}`"
          loading="eager"
        />
      </div>

      <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <p class="text-xs font-medium truncate group-hover:text-primary transition-colors">
          {{ title }}
        </p>
        <template v-if="item.issues?.length">
          <p v-for="(issue, i) in item.issues" :key="i"
            class="text-xs truncate"
            :class="issue.type === 'error' ? 'text-error' : issue.type === 'warning' ? 'text-alert' : 'text-muted'">
            {{ issue.message }}
          </p>
        </template>
        <slot v-else />
        <p v-if="details" class="text-xs text-muted/60 truncate">{{ details }}</p>
      </div>

      <div class="flex flex-col items-end justify-between shrink-0" :class="image ? 'h-16' : 'h-8'">
        <span class="w-1.5 h-1.5 rounded-full" :class="dotColor[status]" />
        <div class="flex items-center gap-1">
          <slot name="leading-actions" />
          <BaseButton
            v-if="showLiveEditor && isLiveEditable && !hideEditorButton"
            variant="icon"
            icon="mdiPencilOutline"
            :tooltip="t('Show in Live Editor')"
            @click.stop="showInLiveEditor"
          />
          <BaseButton
            v-if="showChatbot && chatEnabled && item.issues?.some(i => i.type === 'error' || i.type === 'warning')"
            variant="icon"
            icon="mdiRobot"
            :tooltip="t('Analyze in chat')"
            @click.stop="openInChat"
          />
          <ClaudeButton
            v-if="showClaudeExplain && moduleId && item.issues?.some(i => i.type === 'error' || i.type === 'warning')"
            :loading="explainLoading"
            :label="t('Explain with Claude')"
            icon-only
            @click="explainWithClaude"
          />
          <BaseButton
            v-if="showIgnore && moduleId && !item._ignored && item.issues?.some(i => i.type === 'error' || i.type === 'warning')"
            variant="icon-error"
            icon="mdiEyeOffOutline"
            :tooltip="t('Ignore hint')"
            @click.stop="askIgnore"
          />
          <BaseButton
            v-if="showIgnore && moduleId && item._ignored"
            variant="icon-success"
            icon="mdiEyeOutline"
            :tooltip="ignoreNote ? t('Restore hint') + ' — ' + ignoreNote : t('Restore hint')"
            @click.stop="unignoreItem"
          />
          <slot name="trailing" />
        </div>
      </div>
    </div>

    <button
      @click.stop="open = !open"
      class="w-full flex items-center justify-center gap-1.5 border-t transition-colors"
      :class="[
        open
          ? 'bg-primary/5 border-primary/20 text-primary/70 hover:bg-primary/10'
          : 'border-border/30 text-muted/50 hover:bg-surface-soft-hover hover:text-muted',
        variant === 'box' ? 'px-3 py-1.5' : 'px-1 py-1.5',
      ]"
    >
      <Icon
        name="mdiChevronDown"
        :size="13"
        class="transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      />
      <span class="text-[11px] font-medium tracking-wide">
        {{ open ? t('Hide details') : t('Show more details') }}
      </span>
    </button>

    <div v-if="open">
      <slot v-if="slots.expand" name="expand" />
      <div v-else class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">
        <div v-if="title" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Element</span>
          <span class="text-xs text-light break-all">{{ title }}</span>
        </div>
        <div v-if="details" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Details</span>
          <span class="text-xs text-light break-all">{{ details }}</span>
        </div>
        <div
          v-for="issue in item.issues"
          :key="issue.message"
          class="text-xs"
          :class="issue.type === 'error' ? 'text-error' : issue.type === 'warning' ? 'text-alert' : 'text-success'"
        >{{ issue.message }}</div>
        <div
          v-if="item._ignored && ignoreNote"
          class="text-[11px] text-muted/80 bg-surface rounded px-2 py-1 border border-border/50 flex gap-1.5 items-start"
        >
          <Icon name="mdiNoteOutline" :size="11" class="shrink-0 mt-0.5 text-muted/60" />
          <span class="wrap-break-word leading-snug">{{ ignoreNote }}</span>
        </div>
      </div>
    </div>

    <ClaudeResult
      :open="explainOpen"
      :title="claudeConfig?.title ? t(claudeConfig.title) : t('Explain with Claude')"
      :loading="explainLoading"
      :error="explainError"
      :text="explainText"
      @update:open="explainOpen = $event"
    />

    <ConfirmDialog
      :open="ignoreConfirmOpen"
      :title="t('Ignore this hint?')"
      :message="t('It will be hidden from the issue list. You can restore it any time.')"
      :confirm-text="t('Ignore')"
      variant="danger"
      with-note
      :note-placeholder="t('Why are you ignoring this? (optional)')"
      @update:open="ignoreConfirmOpen = $event"
      @confirm="confirmIgnore"
    />
  </div>
</template>
