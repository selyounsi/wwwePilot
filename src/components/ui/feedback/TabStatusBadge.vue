<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'

const { t } = useI18n()

defineProps({
  status:      { type: String, default: 'unchecked' },
  checkedName: { type: String, default: '' },
})
defineEmits(['switch-tab'])

const config = {
  'current':               { key: 'This tab',                       dot: 'bg-success', text: 'text-success' },
  'editor-match':          { key: 'Live Editor – this page',        dot: 'bg-success', text: 'text-success' },
  'editor-page-mismatch':  { key: 'Live Editor – different page',   dot: 'bg-alert',   text: 'text-alert'   },
  'editor-domain-mismatch':{ key: 'Live Editor – different domain', dot: 'bg-error',   text: 'text-error'   },
  'url-changed':           { key: 'URL changed',                    dot: 'bg-alert',   text: 'text-alert'   },
  'reloaded':              { key: 'Page reloaded',                  dot: 'bg-alert',   text: 'text-alert'   },
  'different-tab':         { key: '',                               dot: 'bg-error',   text: 'text-error'   },
  'unchecked':             { key: 'Not checked',                    dot: 'bg-muted',   text: 'text-muted'   },
}

const clickable = ['editor-match', 'different-tab']
</script>

<template>
  <div
    class="flex items-center gap-1.5 text-xs transition-colors"
    :class="[config[status]?.text, clickable.includes(status) ? 'cursor-pointer hover:opacity-70' : '']"
    @click="clickable.includes(status) ? $emit('switch-tab') : null"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="config[status]?.dot" />
    <span v-if="status === 'different-tab'">
      {{ t('Checked:') }} <span class="font-medium truncate max-w-[120px] inline-block align-bottom">{{ checkedName }}</span>
      <span class="ml-1 opacity-60">↗</span>
    </span>
    <span v-else-if="status === 'editor-match'">
      {{ t(config[status]?.key) }} <span class="ml-1 opacity-60">↗</span>
    </span>
    <span v-else>{{ t(config[status]?.key) }}</span>
  </div>
</template>