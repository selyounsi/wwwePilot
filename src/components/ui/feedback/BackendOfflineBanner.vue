<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useBackendStatus } from '@/composables/useBackendStatus.js'

const { t } = useI18n()
const { state, probe } = useBackendStatus()

function retryNow() { probe() }
</script>

<template>
  <Transition name="offline-pop">
    <button
      v-if="!state.online"
      class="fixed bottom-3 right-3 z-60 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-red-500/50 text-red-400 shadow-lg backdrop-blur-sm hover:bg-red-500/10 transition-colors"
      :title="t('Click to retry')"
      @click="retryNow"
    >
      <span class="relative flex w-2 h-2">
        <span class="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60"></span>
        <span class="relative rounded-full bg-red-500 w-2 h-2"></span>
      </span>
      <span class="text-[11px] font-medium">{{ t('Backend offline') }}</span>
      <span v-if="state.retrying" class="text-[10px] text-red-400/70">{{ t('checking…') }}</span>
    </button>
  </Transition>
</template>

<style scoped>
.offline-pop-enter-active,
.offline-pop-leave-active { transition: transform .22s cubic-bezier(.32,.72,0,1), opacity .18s ease; }
.offline-pop-enter-from,
.offline-pop-leave-to     { transform: translateY(8px) scale(.95); opacity: 0; }
</style>
