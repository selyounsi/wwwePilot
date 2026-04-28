<script setup>
import { onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useTabWatcher }   from '@/services/web-checker/composables/useTabWatcher.js'

const router = useRouter()
const route  = useRoute()
const { modules } = useModuleLoader('web-checker')
const { start, stop } = useTabWatcher(modules)

let port
const onOverlayClick = (msg) => {
  if (msg?.type !== 'OVERLAY_BADGE_CLICK') return
  router.push({
    path:  `/service/web-checker/module/${msg.moduleId}`,
    query: { focus: msg.itemId, t: Date.now() },
  })
}

watch(() => route.fullPath, () => {
  const focus = route.query.focus
  if (!focus) return
  nextTick(() => setTimeout(() => {
    const el = document.getElementById(`item-${focus}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 250))
}, { immediate: true })

onMounted(() => {
  start()
  port = chrome.runtime.connect({ name: 'sidebar' })
  chrome.runtime.onMessage.addListener(onOverlayClick)
})

onUnmounted(() => {
  stop()
  port?.disconnect()
  chrome.runtime.onMessage.removeListener(onOverlayClick)
})
</script>

<template>
  <RouterView />
</template>