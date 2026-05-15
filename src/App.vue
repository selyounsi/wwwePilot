<script setup>
import { onMounted, onUnmounted, onErrorCaptured, watch, nextTick, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useTabWatcher }   from '@/services/web-checker/composables/useTabWatcher.js'
import { useToast }        from '@/composables/useToast.js'
import { useI18n }         from '@/composables/i18n/useI18n.js'

const router = useRouter()
const route  = useRoute()
const { modules } = useModuleLoader('web-checker')
const { start, stop } = useTabWatcher(modules)
const toast = useToast()
const { t } = useI18n()

// The admin tab opens index.html#/admin in a regular browser tab. Side-panel-
// specific wiring (tab watcher for overlay badges, port to background) doesn't
// apply there.
const isAdminContext = computed(() => route.fullPath.startsWith('/admin'))

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
  if (isAdminContext.value) return
  start()
  port = chrome.runtime.connect({ name: 'sidebar' })
  chrome.runtime.onMessage.addListener(onOverlayClick)
})

onUnmounted(() => {
  if (isAdminContext.value) return
  stop()
  port?.disconnect()
  chrome.runtime.onMessage.removeListener(onOverlayClick)
})

// Catch unhandled component errors so a crash in one module doesn't take
// the whole sidebar down silently.
onErrorCaptured((err, _instance, info) => {
  console.error('[App]', info, err)
  toast.error(err?.message || String(err), { title: t('Something went wrong') })
  return false
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[App] unhandled rejection', e.reason)
  toast.error(e.reason?.message || String(e.reason), { title: t('Background error') })
})
</script>

<template>
  <div class="h-full">
    <RouterView />
    <ToastContainer />
    <ReportDialog />
  </div>
</template>
