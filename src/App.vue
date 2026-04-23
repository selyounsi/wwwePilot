<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useTabWatcher }   from '@/services/web-checker/composables/useTabWatcher.js'

const { modules } = useModuleLoader('web-checker')
const { start, stop } = useTabWatcher(modules)

let port
onMounted(() => {
  start()
  port = chrome.runtime.connect({ name: 'sidebar' })
})

onUnmounted(() => {
  stop()
  port?.disconnect()
})
</script>

<template>
  <RouterView />
</template>