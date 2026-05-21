<script setup>
import { onMounted, onUnmounted, onErrorCaptured, watch, nextTick, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useTabWatcher }   from '@/services/web-checker/composables/useTabWatcher.js'
import { useToast }        from '@/composables/useToast.js'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useStartPage, whenStartPageHydrated } from '@/composables/settings/useStartPage.js'
import { whenFeatureFlagsReady } from '@/composables/useFeatureFlags.js'

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

// Read the raw URL hash on first paint. `useRoute()` can momentarily be on
// '/' before vue-router resolves the hash, which used to fool the admin
// guard below and trigger the start-page redirect inside admin / settings
// / module tabs.
const initialPath = (window.location.hash.replace(/^#/, '') || '/').split('?')[0]

onMounted(async () => {
  if (isAdminContext.value || initialPath.startsWith('/admin')) return
  start()
  port = chrome.runtime.connect({ name: 'sidebar' })
  chrome.runtime.onMessage.addListener(onOverlayClick)

  // Initial-route redirect: only fire when the sidebar truly opened on '/'
  // (its default). Anything else means the user navigated explicitly — admin
  // tab, deep-link from a notification, share URL — and we must not hijack
  // that. If the saved target is disabled / removed,
  // `resolveAvailablePath` falls back to '/' and we skip the redirect.
  if (initialPath !== '/') return
  await whenStartPageHydrated()
  await whenFeatureFlagsReady()
  const target = useStartPage().resolveAvailablePath()
  if (target && target !== '/' && router.currentRoute.value.path === '/') {
    router.replace(target)
  }
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
    <BackendOfflineBanner />
  </div>
</template>
