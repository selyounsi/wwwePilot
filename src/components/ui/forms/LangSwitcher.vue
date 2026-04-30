<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'

const { lang, setLang } = useI18n()

function toggle() {
  setLang(lang.value === 'en' ? 'de' : 'en')
}
</script>

<template>
  <button
    @click="toggle"
    class="px-2 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-[11px] font-bold text-black/70 transition-colors shrink-0"
    :title="lang === 'en' ? 'Sprache wechseln (Deutsch)' : 'Switch language (English)'"
  >
    {{ lang.toUpperCase() }}
  </button>
</template>
