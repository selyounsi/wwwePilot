<script setup>
defineProps({
  status:      { type: String, default: 'unchecked' },
  checkedName: { type: String, default: '' },
})
defineEmits(['switch-tab'])

const config = {
  'current':               { label: 'Dieser Tab',                  dot: 'bg-success', text: 'text-success' },
  'editor-match':          { label: 'Live Editor – diese Seite',   dot: 'bg-success', text: 'text-success' },
  'editor-page-mismatch':  { label: 'Live Editor – andere Seite',  dot: 'bg-alert',   text: 'text-alert'   },
  'editor-domain-mismatch':{ label: 'Live Editor – andere Domain', dot: 'bg-error',   text: 'text-error'   },
  'url-changed':           { label: 'URL geändert',                dot: 'bg-alert',   text: 'text-alert'   },
  'reloaded':              { label: 'Seite neu geladen',           dot: 'bg-alert',   text: 'text-alert'   },
  'different-tab':         { label: '',                            dot: 'bg-error',   text: 'text-error'   },
  'unchecked':             { label: 'Nicht geprüft',               dot: 'bg-muted',   text: 'text-muted'   },
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
      Geprüft: <span class="font-medium truncate max-w-[120px] inline-block align-bottom">{{ checkedName }}</span>
      <span class="ml-1 opacity-60">↗</span>
    </span>
    <span v-else-if="status === 'editor-match'">
      {{ config[status]?.label }} <span class="ml-1 opacity-60">↗</span>
    </span>
    <span v-else>{{ config[status]?.label }}</span>
  </div>
</template>