<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useI18n }            from '@/composables/i18n/useI18n.js'
import { useClaude }          from '@/services/chatbot/modules/claude/composables/useClaude.js'
import { useLiveEditorBridge } from '@/composables/liveEditor/useLiveEditorBridge.js'
import ClaudeResult           from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'

const props = defineProps({ item: Object })

const { t }   = useI18n()
const claude  = useClaude()

const { actions = {} } = inject('moduleOverlay', {})
const showLiveEditor = actions.liveEditor !== false
const showAltText    = actions.altText    !== false

const {
  editorTab,
  isCms4Site,
  focusItem:        focusInLiveEditor,
  requestEditable:  requestLiveEditable,
  getEditable:      getLiveEditable,
  openEditor:       openLiveEditor,
} = useLiveEditorBridge()

// Queue editability probe outside the computed below — same reason as in
// ModuleItem: keep the computed pure so re-renders don't re-fire requests.
watch(
  [editorTab, () => props.item],
  () => { if (editorTab.value) requestLiveEditable(props.item) },
  { immediate: true },
)

const normalized = computed(() => ({
  ...props.item,
  title: props.item.name || (props.item.isBackground ? 'Hintergrundbild' : props.item.isLightbox ? 'Lightbox-Link' : 'Bild'),
  details: props.item.isBackground
    ? 'CSS background-image'
    : props.item.isLightbox
    ? (props.item.alt ? `aria-label: "${props.item.alt}"` : '')
    : (props.item.width ? `${props.item.width} × ${props.item.height}px` : ''),
  image: props.item.src || null,
}))

const isUpscaled = computed(() =>
  !props.item.isVector
  && !props.item.isLazy
  && (props.item.renderedWidth - props.item.width > 2
   || props.item.renderedHeight - props.item.height > 2)
)

const isImageEl = computed(() => !props.item.isBackground && !props.item.isLightbox && !!props.item.src)

const hasAltIssue = computed(() => {
  if (!isImageEl.value) return false
  const issues = props.item.issues ?? []
  return issues.some(i =>
    i.type !== 'success'
    && /alt/i.test(i.title || i.message || '')
  )
})

// Live-Editor pencil state for image items: hidden entirely on non-CMS4
// audit targets (a CMS3 / WP image has no chance of landing in the LE);
// otherwise the three known states.
//   focus → LE open + image editable
//   open  → LE not open yet, click opens it
//   inert → LE open but image is outside an editable wrapper
const liveEditorState = computed(() => {
  if (!isCms4Site.value)                     return 'hidden'
  if (!editorTab.value)                      return 'open'
  if (getLiveEditable(props.item) === true)  return 'focus'
  return 'inert'
})

const liveEditorTooltip = computed(() => {
  if (liveEditorState.value === 'focus') return t('Show in Live Editor')
  if (liveEditorState.value === 'open')  return t('Open Live Editor')
  return t('Element not editable in Live Editor')
})

// Fire-and-forget — focusInLiveEditor's executeScript can take a moment on
// heavy LE pages, awaiting it freezes the click handler.
function handleLiveEditor() {
  if (liveEditorState.value === 'focus') focusInLiveEditor(props.item)
  else if (liveEditorState.value === 'open') openLiveEditor()
  // 'inert' / 'hidden' → no-op
}

const altOpen    = ref(false)
const altLoading = ref(false)
const altText    = ref('')
const altError   = ref('')

async function generateAlt() {
  altOpen.value    = true
  altText.value    = ''
  altError.value   = ''
  altLoading.value = true
  try {
    const src = props.item.src
    if (!src) throw new Error('No image source')

    const context = [
      props.item.name ? `Filename: ${props.item.name}` : null,
      props.item.alt  ? `Current alt: "${props.item.alt}"` : 'No alt text yet.',
    ].filter(Boolean).join('\n')

    const result = await claude.run({
      max_tokens: 150,
      system: 'Du schreibst prägnante, sachliche Alt-Texte auf Deutsch für Website-Bilder. ' +
              'Gib NUR den Alt-Text zurück — keine Erklärungen, keine Anführungszeichen, kein "Bild von" / "Foto von". ' +
              'Beschreibe was im Bild zu sehen ist, nicht den Zweck. 5–15 Wörter.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: src } },
          { type: 'text', text: context },
        ],
      }],
    })
    altText.value = result.text.trim().replace(/^["']|["']$/g, '')
  } catch (e) {
    altError.value = e.message || String(e)
  } finally {
    altLoading.value = false
  }
}
</script>

<template>
  <div>
    <ModuleItem :item="normalized" variant="box" hide-editor-button>
      <template #leading-actions>
        <BaseButton
          v-if="showLiveEditor && liveEditorState !== 'hidden'"
          variant="icon"
          icon="mdiPencilOutline"
          :icon-size="13"
          :tooltip="liveEditorTooltip"
          :disabled="liveEditorState === 'inert'"
          :class="liveEditorState === 'open' ? 'text-primary/70!' : ''"
          @click.stop="handleLiveEditor"
        />
        <BaseButton
          v-if="showAltText && isImageEl && claude.isAvailable.value"
          variant="icon"
          icon="mdiTagTextOutline"
          :icon-size="13"
          :tooltip="hasAltIssue ? t('Generate alt text — needs attention') : t('Generate alt text')"
          :loading="altLoading"
          :class="hasAltIssue ? 'text-alert! hover:text-alert!' : ''"
          @click.stop="generateAlt"
        />
      </template>

      <template #expand>
        <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

          <DetailRow v-if="item.name" label="Dateiname">{{ item.name }}</DetailRow>

          <DetailRow v-if="item.width" :label="item.isLazy ? 'Erwartet' : 'Original'">
            {{ item.width }} × {{ item.height }}px<span v-if="item.isLazy" class="text-muted/60 ml-1">(noch nicht geladen)</span>
          </DetailRow>

          <DetailRow v-if="item.renderedWidth" label="Gerendert">
            <span :class="isUpscaled ? 'text-alert' : ''">
              {{ item.renderedWidth }} × {{ item.renderedHeight }}px<span v-if="item.isVector" class="text-muted/60 ml-1">(Vektor)</span>
            </span>
          </DetailRow>

          <DetailRow v-if="item.src" label="Pfad">
            <span class="text-muted/70 font-mono" style="font-size: 10px">{{ item.src }}</span>
          </DetailRow>

          <div
            v-for="issue in item.issues"
            :key="issue.message"
            class="text-xs"
            :class="issue.type === 'error' ? 'text-error' : 'text-alert'"
          >{{ issue.message }}</div>

        </div>
      </template>
    </ModuleItem>

    <ClaudeResult
      :open="altOpen"
      :title="t('Suggested alt text')"
      :loading="altLoading"
      :error="altError"
      :text="altText"
      @update:open="altOpen = $event"
    />
  </div>
</template>
