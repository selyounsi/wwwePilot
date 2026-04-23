import { computed, onUnmounted } from 'vue'
import { useCheckStore }  from '@/services/web-checker/composables/useCheckStore.js'
import { usePageOverlay } from './usePageOverlay.js'

export function useModuleOverlay(moduleId, overlayConfig) {
  const { state } = useCheckStore()
  const po        = usePageOverlay()

  const hasOverlay = !!overlayConfig?.enabled

  const result = computed(() => state.results[moduleId] ?? { items: [] })

  const overlayItems = computed(() =>
    (result.value.items ?? [])
      .filter(item => item.visible !== false)
      .map(item => ({
        id:     item.element,
        label:  overlayConfig?.labelFn?.(item) ?? '',
        meta:   item._meta  ?? {},
        type:   item.type   ?? 'success',
        issues: (item.issues ?? []).map(i => ({ type: i.type, message: i.message })),
      }))
  )

  function toggle() {
    po.toggle(overlayItems.value)
  }

  onUnmounted(() => po.hide())

  return {
    hasOverlay,
    overlayActive: po.active,
    overlayToggle: toggle,
    labelFn: overlayConfig?.labelFn ?? (() => ''),
    onText:  overlayConfig?.onText  ?? 'Ausblenden',
    offText: overlayConfig?.offText ?? 'Einblenden',
  }
}