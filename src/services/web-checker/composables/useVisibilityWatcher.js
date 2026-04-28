import { onMounted, onUnmounted } from 'vue'
import { useCheckStore }  from './useCheckStore.js'
import { APP_NAME_LOWER } from '@/config/app.js'

export function useVisibilityWatcher(moduleId) {
  const { state, setResult } = useCheckStore()
  let pollInterval  = null
  let lastTabId     = null

  // runs in the page context via executeScript
  const VISIBILITY_SCRIPT = (ids, prefix) => {
    function isVisible(el, win) {
      const style = win.getComputedStyle(el)
      if (style.display === 'none')        return false
      if (style.visibility === 'hidden')   return false
      if (parseFloat(style.opacity) === 0) return false

      let parent = el.parentElement
      while (parent && parent !== win.document.body) {
        const ps = win.getComputedStyle(parent)
        if (ps.display === 'none' || ps.visibility === 'hidden') return false
        if (ps.position === 'fixed' || ps.position === 'sticky') break
        parent = parent.parentElement
      }
      return true
    }

    return ids.map(id => {
      const el = document.querySelector(`[data-${prefix}-id="${id}"]`)
      if (el) return { id, visible: isVisible(el, window) }

      // live-editor iframe: contentWindow is required so getComputedStyle resolves correctly
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const found = iframe.contentDocument?.querySelector(`[data-${prefix}-id="${id}"]`)
          if (found) return { id, visible: isVisible(found, iframe.contentWindow) }
        } catch {}
      }

      return { id, visible: null } // null = not found, do not overwrite previous value
    })
  }

  async function recheckVisibility(tabId) {
    const result = state.results[moduleId]
    if (!result?.items?.length) return

    const ids = result.items.map(i => i.element)

    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func:   VISIBILITY_SCRIPT,
      args:   [ids, APP_NAME_LOWER],
    }).catch(() => [{ result: [] }])

    if (!res?.result?.length) return

    const map     = Object.fromEntries(res.result.filter(r => r.visible !== null).map(r => [r.id, r.visible]))
    const updated = result.items.map(item => ({
      ...item,
      visible: item.element in map ? map[item.element] : item.visible,
    }))

    const changed = updated.some((item, i) => item.visible !== result.items[i].visible)
    if (changed) setResult(moduleId, { ...result, items: updated })
  }

  async function injectDirtyListener(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__wpVisibilityListenerActive) return
        window.__wpVisibilityListenerActive = true
        window.__wpVisibilityDirty = false
        const mark = () => { window.__wpVisibilityDirty = true }
        window.addEventListener('scroll', mark, { passive: true })
        window.addEventListener('resize', mark, { passive: true })
        document.querySelectorAll('iframe').forEach(f => {
          try { f.contentWindow?.addEventListener('scroll', mark, { passive: true }) } catch {}
        })
      },
    }).catch(() => {})
  }

  async function isDirty(tabId) {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const d = window.__wpVisibilityDirty ?? false
        window.__wpVisibilityDirty = false
        return d
      },
    }).catch(() => [{ result: false }])
    return res?.result ?? false
  }

  async function onTabActivated({ tabId }) {
    lastTabId = tabId
    await injectDirtyListener(tabId)
    await recheckVisibility(tabId)
  }

  onMounted(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    lastTabId = tab.id

    await injectDirtyListener(tab.id)
    await recheckVisibility(tab.id)
    // second pass: gives lazy-loaded elements a chance to render
    setTimeout(() => recheckVisibility(tab.id), 600)

    // re-check only after scroll/resize, otherwise idle
    pollInterval = setInterval(async () => {
      if (!lastTabId) return
      if (await isDirty(lastTabId)) recheckVisibility(lastTabId)
    }, 400)

    chrome.tabs.onActivated.addListener(onTabActivated)
  })

  onUnmounted(() => {
    clearInterval(pollInterval)
    chrome.tabs.onActivated.removeListener(onTabActivated)
  })
}