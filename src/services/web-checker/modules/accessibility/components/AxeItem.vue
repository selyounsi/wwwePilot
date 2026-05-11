<script setup>
import { computed, ref } from 'vue'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useClaude }     from '@/services/chatbot/modules/claude/composables/useClaude.js'
import ClaudeButton      from '@/services/chatbot/modules/claude/components/ClaudeButton.vue'
import ClaudeResult      from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'

const props = defineProps({ item: Object })

const { t }  = useI18n()
const claude = useClaude()

const IMPACT_LABEL = {
  critical: 'Kritisch',
  serious:  'Schwerwiegend',
  moderate: 'Mittel',
  minor:    'Gering',
  review:   'Manuelle Prüfung',
}

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.target || props.item.ruleId || '',
  details: props.item.ruleId || '',
}))

const impactLabel = computed(() => IMPACT_LABEL[props.item.impact] ?? props.item.impact ?? '')
const impactClass = computed(() =>
  props.item.impact === 'critical' || props.item.impact === 'serious' ? 'text-error' : 'text-alert'
)

const NAME_MISSING_RULES = new Set([
  'button-name',
  'link-name',
  'input-button-name',
  'image-alt',
  'aria-input-field-name',
  'aria-command-name',
  'aria-toggle-field-name',
  'aria-meter-name',
  'aria-progressbar-name',
  'aria-tooltip-name',
  'aria-treeitem-name',
  'frame-title',
  'form-field-multiple-labels',
  'object-alt',
  'svg-img-alt',
])

const canGenerateAria = computed(() =>
  NAME_MISSING_RULES.has(props.item.ruleId) && !!props.item.nodeHtml
)

const ariaOpen    = ref(false)
const ariaLoading = ref(false)
const ariaText    = ref('')
const ariaError   = ref('')

async function generateAriaLabel() {
  ariaOpen.value    = true
  ariaText.value    = ''
  ariaError.value   = ''
  ariaLoading.value = true
  try {
    const snippet = props.item.nodeHtml || ''

    const userMessage = [
      `Axe rule: ${props.item.ruleId}`,
      `Selector: ${props.item.target || ''}`,
      '',
      'Element HTML:',
      '```html',
      snippet,
      '```',
    ].join('\n')

    const result = await claude.run({
      max_tokens: 200,
      system: 'Du schreibst kurze, sachliche ARIA-Labels (oder Alt-Texte) auf Deutsch. ' +
              'Gib NUR den Label-Wert zurück — keine Erklärungen, keine Anführungszeichen, ' +
              'kein "aria-label=", kein HTML-Wrapper, kein "Bild von" / "Button zum". ' +
              '2–8 Wörter, beschreibt was das Element tut oder zeigt, aus dem HTML-Kontext erschlossen. ' +
              'Wenn das Element ein Button ist: Verb voran (z.B. "Menü öffnen", "Formular abschicken"). ' +
              'Wenn es ein Link ist: das Ziel beschreiben (z.B. "Zur Startseite"). ' +
              'Wenn es ein Bild ist: Bildinhalt knapp benennen.',
      messages: [{ role: 'user', content: userMessage }],
    })
    ariaText.value = result.text.trim().replace(/^["']|["']$/g, '')
  } catch (e) {
    ariaError.value = e.message || String(e)
  } finally {
    ariaLoading.value = false
  }
}
</script>

<template>
  <div>
    <ModuleItem :item="normalized" variant="box">
      <template v-if="canGenerateAria" #leading-actions>
        <BaseButton
          variant="icon"
          icon="mdiTagTextOutline"
          :icon-size="13"
          :tooltip="t('Generate ARIA label')"
          :loading="ariaLoading"
          :class="ariaError ? 'text-error!' : ''"
          @click.stop="generateAriaLabel"
        />
      </template>

      <template #expand>
        <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

          <DetailRow v-if="item.ruleId" label="Regel">
            <span class="font-mono">{{ item.ruleId }}</span>
          </DetailRow>

          <DetailRow v-if="item.impact" label="Impact">
            <span :class="impactClass">{{ impactLabel }}</span>
          </DetailRow>

          <DetailRow v-if="item.target" label="Selector">
            <span class="font-mono">{{ item.target }}</span>
          </DetailRow>

          <DetailRow v-if="item.nodeHtml" label="HTML">
            <span class="font-mono" style="white-space: pre-wrap">{{ item.nodeHtml }}</span>
          </DetailRow>

          <DetailRow v-if="item.helpUrl" label="Doku">
            <a :href="item.helpUrl" target="_blank" rel="noreferrer" class="text-primary hover:underline">{{ item.helpUrl }}</a>
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
      :open="ariaOpen"
      :title="t('Suggested ARIA label')"
      :loading="ariaLoading"
      :error="ariaError"
      :text="ariaText"
      @update:open="ariaOpen = $event"
    />
  </div>
</template>
