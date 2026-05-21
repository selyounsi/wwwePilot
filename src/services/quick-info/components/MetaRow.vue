<script setup>
import { ref, computed } from 'vue'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'

/**
 * Label-Value row used in the Quick-Page-Info cards. One-liner by default;
 * if the value would overflow, an info-button expands it inline. Optional
 * copy + open-in-tab actions are surfaced on the right.
 *
 * Empty values render as a dimmed em-dash so the row alignment stays stable.
 */

const props = defineProps({
  label:    { type: String,  required: true },
  value:    { type: [String, Number, null], default: null },
  href:     { type: String,  default: null },    // when set, value renders as a link
  copyable: { type: Boolean, default: false },
  openable: { type: Boolean, default: false },
  // When the value is intrinsically short (status codes, counts) we skip
  // the expand button — there's nothing to expand.
  expandable: { type: Boolean, default: true },
})

const { t }   = useI18n()
const toast   = useToast()

const expanded = ref(false)

const text = computed(() => {
  if (props.value == null) return ''
  return String(props.value)
})

const isEmpty = computed(() => !text.value.trim())

// Heuristic — anything past ~28 chars probably won't fit in one row at
// sidebar width. The user can always click to confirm.
const couldOverflow = computed(() => props.expandable && text.value.length > 28)

async function copy() {
  if (!text.value) return
  try {
    await navigator.clipboard.writeText(text.value)
    toast.success(t('Copied'))
  } catch (e) { toast.error(e.message) }
}

function open() {
  if (!props.href) return
  if (/^mailto:|^tel:/i.test(props.href)) window.open(props.href, '_self')
  else                                    chrome.tabs.create({ url: props.href })
}
</script>

<template>
  <div class="flex items-start gap-2 py-1 min-h-5.5">
    <div class="text-[10px] text-muted/60 uppercase tracking-wide w-18 shrink-0 pt-0.5">
      {{ label }}
    </div>
    <div class="flex-1 min-w-0 flex items-center gap-1">
      <slot name="prefix" />
      <template v-if="isEmpty">
        <span class="text-xs text-muted/40">—</span>
      </template>
      <template v-else>
        <a
          v-if="href"
          href="#"
          class="text-xs text-primary hover:underline flex-1 min-w-0"
          :class="expanded ? 'wrap-break-word' : 'truncate'"
          @click.prevent="open"
        >{{ text }}</a>
        <div
          v-else
          class="text-xs flex-1 min-w-0"
          :class="expanded ? 'wrap-break-word' : 'truncate'"
        >{{ text }}</div>
      </template>
    </div>
    <div class="flex items-center gap-0.5 shrink-0">
      <BaseButton
        v-if="couldOverflow && !isEmpty"
        variant="icon"
        :icon="expanded ? 'mdiUnfoldLessHorizontal' : 'mdiUnfoldMoreHorizontal'"
        :icon-size="12"
        :tooltip="expanded ? t('Collapse') : t('Expand')"
        @click="expanded = !expanded"
      />
      <BaseButton
        v-if="copyable && !isEmpty"
        variant="icon"
        icon="mdiContentCopy"
        :icon-size="12"
        :tooltip="t('Copy')"
        @click="copy"
      />
      <BaseButton
        v-if="openable && href && !isEmpty"
        variant="icon"
        icon="mdiOpenInNew"
        :icon-size="12"
        :tooltip="t('Open')"
        @click="open"
      />
    </div>
  </div>
</template>
