<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useActiveTab, focusOrOpenTab } from '@/composables/useActiveTab.js'

const props = defineProps({
  capabilities: { type: Object, required: true },
  locked:       { type: Boolean, default: false },
})
const emit = defineEmits(['update'])

const { t } = useI18n()
const { tabId, tabUrl } = useActiveTab()

const currentHost = computed(() => {
  try { return tabUrl.value ? new URL(tabUrl.value).host : '' } catch { return '' }
})

// Once tools are on, the chat stays bound to the host it was pinned to —
// switching tabs must not silently retarget an edit.
const boundHost = computed(() => props.capabilities.pinnedHost || currentHost.value)
const tabChanged = computed(() =>
  Boolean(props.capabilities.pinnedHost && currentHost.value && currentHost.value !== props.capabilities.pinnedHost)
)

const options = [
  { id: 'none', icon: 'mdiChatOutline',     label: 'No extra tools',
    hint: 'Plain chat — Claude answers from the conversation only.' },
  { id: 'cms4', icon: 'mdiToyBrickOutline', label: 'CMS4 tools',
    hint: 'Read and edit pages in the CMS4 live editor.' },
]

const active = computed(() => (props.capabilities.cms4 ? 'cms4' : 'none'))

function choose(id) {
  if (props.locked) return
  if (id === 'cms4') {
    emit('update', {
      cms4:        true,
      pinnedHost:  currentHost.value,
      pinnedTabId: tabId.value,
      pinnedUrl:   tabUrl.value,
    })
  } else {
    emit('update', { cms4: false })
  }
}

function goToTab() {
  focusOrOpenTab({
    host:  props.capabilities.pinnedHost || currentHost.value,
    tabId: props.capabilities.pinnedTabId,
    url:   props.capabilities.pinnedUrl,
  })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-[11px] text-muted uppercase tracking-wide">{{ t('Capabilities for this chat') }}</p>

    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      :disabled="locked"
      class="w-full text-left rounded-xl border px-3 py-2.5 flex items-start gap-2.5 transition-colors"
      :class="[
        active === opt.id ? 'border-primary/60 bg-primary/10' : 'border-border bg-surface hover:border-border/80',
        locked ? 'opacity-60 cursor-default' : 'cursor-pointer',
      ]"
      @click="choose(opt.id)"
    >
      <Icon :name="opt.icon" :size="15" class="shrink-0 mt-0.5" :class="active === opt.id ? 'text-primary' : 'text-muted'" />
      <span class="min-w-0 flex-1">
        <span class="block text-xs font-medium text-light">{{ t(opt.label) }}</span>
        <span class="block text-[11px] text-muted leading-snug mt-0.5">{{ t(opt.hint) }}</span>
      </span>
      <Icon v-if="active === opt.id" name="mdiCheckCircle" :size="14" class="text-primary shrink-0 mt-0.5" />
    </button>

    <div v-if="capabilities.cms4" class="rounded-xl border border-border bg-surface px-3 py-2.5 flex flex-col gap-1.5">
      <span class="text-[11px] text-muted">{{ t('Target website') }}</span>
      <div class="flex items-center gap-2">
        <Icon name="mdiTabUnselected" :size="14" class="text-primary shrink-0" />
        <span class="text-xs font-medium text-light">{{ t('Current tab') }}</span>
      </div>
      <code v-if="boundHost" class="text-[11px] text-primary font-mono break-all">{{ boundHost }}</code>
      <span v-else class="text-[11px] text-error">{{ t('No website detected in the current tab.') }}</span>

      <div v-if="tabChanged" class="flex flex-col gap-1.5 mt-1 pt-2 border-t border-border/60">
        <span class="text-[11px] text-alert leading-snug">
          {{ t('This chat stays on {pinned}. The current tab shows {current}.', { pinned: capabilities.pinnedHost, current: currentHost }) }}
        </span>
        <BaseButton variant="pill" icon="mdiArrowLeftTop" :icon-size="12" class="self-start" @click="goToTab">
          {{ t('Back to {host}', { host: capabilities.pinnedHost }) }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
