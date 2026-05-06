<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'

const { lang, setLang } = useI18n()

function toggle() {
  setLang(lang.value === 'en' ? 'de' : 'en')
}
</script>

<template>
  <BaseButton
    variant="header-icon"
    :tooltip="lang === 'en' ? 'Sprache wechseln (Deutsch)' : 'Switch language (English)'"
    class="px-2 py-1 text-[11px] font-bold text-black/70 hover:bg-black/20 bg-black/10 shrink-0"
    @click="toggle"
  >
    {{ lang.toUpperCase() }}
  </BaseButton>
</template>
