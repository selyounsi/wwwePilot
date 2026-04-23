import { usePageOverlay } from '@/composables/overlay/usePageOverlay.js'

export async function highlightElement(item, label, clickType = 'click') {
  const { showSingle } = usePageOverlay()

  await showSingle({
    id:     item.element,
    label:  label,
    type:   item.type  ?? 'success',
    issues: (item.issues ?? []).map(i => ({ type: i.type, message: i.message })),
    meta:   item._meta ?? {},
  })
}