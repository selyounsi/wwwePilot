<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n }      from '@/composables/i18n/useI18n.js'
import { useToast }     from '@/composables/useToast.js'
import { useExtraction } from '@/services/quick-info/composables/useExtraction.js'

const props = defineProps({
  profile: { type: Object, required: true },
  tabId:   { type: [Number, String], default: null },
  tabUrl:  { type: String, default: '' },
})

const { t }  = useI18n()
const toast  = useToast()
const { state: extractionState, runExtraction } = useExtraction()

const showEmptyRules = ref(true)

watch(() => [props.profile, props.tabId, props.tabUrl], async () => {
  if (props.profile && props.tabId) {
    try { await runExtraction(props.profile, props.tabId) }
    catch (e) { console.warn('[quick-info] extraction failed', e) }
  }
}, { immediate: true })

function isEmpty(value) {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return !value.text && !value.href
  return String(value).trim() === ''
}

function displayText(value) {
  if (value == null) return ''
  if (typeof value === 'object' && !Array.isArray(value)) return value.text ?? value.href ?? ''
  return String(value)
}

async function copyValue(value) {
  const text = Array.isArray(value)
    ? value.map(displayText).join('\n')
    : displayText(value)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('Copied'))
  } catch (e) { toast.error(e.message) }
}

function openLink(value) {
  const href = typeof value === 'object' ? value.href : value
  if (!href) return
  if (/^mailto:|^tel:/i.test(href)) window.open(href, '_self')
  else                              chrome.tabs.create({ url: href })
}

function sendToChat(rule, value) {
  const text = Array.isArray(value)
    ? value.map(displayText).join('\n')
    : displayText(value)
  if (!text) return
  // Placeholder until chatbot exposes a programmatic ingest.
  toast.info(t('Send-to-chat: {label}', { label: rule.title }))
}

function ruleHasAction(rule, action) {
  return Array.isArray(rule.actions) && rule.actions.includes(action)
}

defineExpose({ runExtraction: () => runExtraction(props.profile, props.tabId) })
</script>

<template>
  <div class="space-y-3">
    <div class="px-1">
      <div class="text-xs font-semibold">{{ profile.name }}</div>
      <div v-if="profile.description" class="text-[10px] text-muted/70 mt-0.5">
        {{ profile.description }}
      </div>
    </div>

    <BaseCard
      v-for="section in profile.sections"
      :key="section.id"
      :title="section.label"
    >
      <div class="space-y-2">
        <template v-for="rule in section.rules" :key="rule.id">
          <div
            v-if="showEmptyRules || !isEmpty(extractionState.values[rule.id])"
            class="border-b border-border/50 last:border-b-0 pb-2 last:pb-0"
          >
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <div class="text-[10px] text-muted uppercase tracking-wide flex items-center gap-1">
                {{ rule.title }}
                <InfoHint v-if="rule.description" :text="rule.description" />
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <BaseButton
                  v-if="ruleHasAction(rule, 'copy') && !isEmpty(extractionState.values[rule.id])"
                  variant="icon"
                  icon="mdiContentCopy"
                  :icon-size="13"
                  :tooltip="t('Copy')"
                  @click="copyValue(extractionState.values[rule.id])"
                />
                <BaseButton
                  v-if="ruleHasAction(rule, 'open') && rule.kind === 'link' && extractionState.values[rule.id]?.href"
                  variant="icon"
                  icon="mdiOpenInNew"
                  :icon-size="13"
                  :tooltip="t('Open')"
                  @click="openLink(extractionState.values[rule.id])"
                />
                <BaseButton
                  v-if="ruleHasAction(rule, 'chat') && !isEmpty(extractionState.values[rule.id])"
                  variant="icon"
                  icon="mdiRobotOutline"
                  :icon-size="13"
                  :tooltip="t('Analyse in chat')"
                  @click="sendToChat(rule, extractionState.values[rule.id])"
                />
              </div>
            </div>

            <div class="text-xs break-words">
              <template v-if="isEmpty(extractionState.values[rule.id])">
                <span class="text-muted/40">—</span>
              </template>

              <template v-else-if="rule.multiple && Array.isArray(extractionState.values[rule.id])">
                <ul class="list-disc pl-4 space-y-0.5">
                  <li v-for="(v, idx) in extractionState.values[rule.id]" :key="idx">
                    <a
                      v-if="rule.kind === 'link' && v.href"
                      class="text-primary hover:underline"
                      href="#"
                      @click.prevent="openLink(v)"
                    >{{ displayText(v) }}</a>
                    <span v-else>{{ displayText(v) }}</span>
                  </li>
                </ul>
              </template>

              <template v-else-if="rule.kind === 'link' && extractionState.values[rule.id]?.href">
                <a
                  class="text-primary hover:underline"
                  href="#"
                  @click.prevent="openLink(extractionState.values[rule.id])"
                >{{ displayText(extractionState.values[rule.id]) }}</a>
              </template>

              <template v-else>
                {{ displayText(extractionState.values[rule.id]) }}
              </template>
            </div>
          </div>
        </template>
        <div v-if="!section.rules.length" class="text-[10px] text-muted/50 italic">
          {{ t('No rules in this section.') }}
        </div>
      </div>
    </BaseCard>

    <div class="px-1 pt-1">
      <label class="text-[10px] text-muted/70 inline-flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" v-model="showEmptyRules" class="h-3 w-3" />
        {{ t('Show empty fields') }}
      </label>
    </div>
  </div>
</template>
