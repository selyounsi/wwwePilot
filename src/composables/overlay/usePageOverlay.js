import { ref } from 'vue'
import { useCheckStore }  from '@/services/web-checker/composables/useCheckStore.js'
import { APP_NAME_LOWER } from '@/config/app.js'

function buildOverlayScript() {
  return (items, prefix) => {
    document.getElementById('__wp-overlays')?.remove()
    window.removeEventListener('scroll', window.__wpOverlayUpdate)
    window.removeEventListener('resize', window.__wpOverlayUpdate)
    if (window.__wpOverlayIframeCleanup) {
      window.__wpOverlayIframeCleanup()
      delete window.__wpOverlayIframeCleanup
    }

    const colors = { error: '#991b1b', warning: '#92400e', success: '#3a5c09' }
    const fg     = '#ffffff' // Weiß auf allen dunklen Farben

    const container = document.createElement('div')
    container.id = '__wp-overlays'
    container.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:999999;width:100%;height:100%;'
    document.body.appendChild(container)

    // ── _overlayFrontend.js ───────────────────────────────────
    function findElementFrontend(id) {
      const el = document.querySelector(`[data-${prefix}-id="${id}"]`)
      if (el) return { el, offsetX: 0, offsetY: 0 }
      return null
    }

    // ── _overlayLiveEditor.js ─────────────────────────────────
    function findByMeta(doc, meta) {
      if (meta.tag !== undefined && meta.idx !== undefined) {
        const byIdx = doc.querySelectorAll(meta.tag)[meta.idx] ?? null
        if (byIdx) return byIdx
      }
      // Text-Fallback – für Kontrast und andere text-basierte Elemente
      if (meta.text && meta.tag) {
        const needle = meta.text.trim().toLowerCase()
        const found = Array.from(doc.querySelectorAll(meta.tag)).find(el =>
          (el.innerText || el.textContent || '').trim().toLowerCase().startsWith(needle)
        )
        if (found) return found
      }
      if (meta.src || meta.name || meta.alt) {
        const baseName = (meta.name || meta.src || '')
          .split('/').pop()
          .replace(/\.[^.]+$/, '')
          .replace(/_(small|medium|large|resized|x1|x2).*$/i, '')
        if (meta.alt?.length > 3) {
          const byAlt = doc.querySelector(`img[alt="${meta.alt}"]`)
          if (byAlt) return byAlt
        }
        if (baseName) {
          return Array.from(doc.querySelectorAll('img')).find(img =>
            (img.getAttribute('src')              ?? '').includes(baseName) ||
            (img.getAttribute('data-src')         ?? '').includes(baseName) ||
            (img.getAttribute('data-pic-cms-src') ?? '').includes(baseName)
          ) ?? null
        }
      }
      return null
    }

    function findElementLiveEditor(id, meta) {
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const iDoc = iframe.contentDocument
          if (!iDoc) continue
          const found = iDoc.querySelector(`[data-${prefix}-id="${id}"]`) ?? findByMeta(iDoc, meta)
          if (!found) continue
          const iRect = iframe.getBoundingClientRect()
          return { el: found, offsetX: iRect.left, offsetY: iRect.top }
        } catch {}
      }
      return null
    }

    function attachIframeScrollListeners(updateFn) {
      const wins = []
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const iWin = iframe.contentWindow
          if (!iWin) continue
          iWin.addEventListener('scroll', updateFn, { passive: true })
          wins.push(iWin)
        } catch {}
      }
      return () => wins.forEach(w => { try { w.removeEventListener('scroll', updateFn) } catch {} })
    }
    // ─────────────────────────────────────────────────────────

    function renderBadge(hit, item) {
      const { el, offsetX, offsetY } = hit
      const rect = el.getBoundingClientRect()

      const absTop    = rect.top    + offsetY
      const absBottom = rect.bottom + offsetY
      const absLeft   = rect.left   + offsetX
      const absRight  = rect.right  + offsetX

      if (rect.width === 0 || rect.height === 0) return
      if (absBottom < 0 || absTop > window.innerHeight) return

      const color = colors[item.type] ?? colors.success

      const badge = document.createElement('div')
      badge.setAttribute('data-wp-badge', 'true')
      badge.style.cssText = `
        position:fixed;
        background:${color};
        border:none;
        border-left:4px solid rgba(255,255,255,0.25);
        border-radius:6px;
        padding:6px 12px;
        font:13px/1.5 system-ui,sans-serif;
        font-weight:600;
        color:${fg};
        pointer-events:auto;
        max-width:280px;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        cursor:default;
        transition:opacity 0.15s, transform 0.15s;
        z-index:1;
      `
      badge.addEventListener('mouseenter', () => {
        container.querySelectorAll('[data-wp-badge]').forEach(b => {
          if (b !== badge) b.style.opacity = '0.2'
        })
        badge.style.zIndex   = '2'
        badge.style.transform = 'scale(1.03)'
        badge.style.boxShadow = `0 4px 16px rgba(0,0,0,0.7)`
      })
      badge.addEventListener('mouseleave', () => {
        container.querySelectorAll('[data-wp-badge]').forEach(b => {
          b.style.opacity   = '1'
          b.style.zIndex    = '1'
        })
        badge.style.transform = ''
        badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)'
      })

      const labelEl = document.createElement('div')
      labelEl.style.cssText = 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'
      labelEl.textContent = item.label
      badge.appendChild(labelEl)

      const realIssues = (item.issues ?? []).filter(i => i.type !== 'success')
      realIssues.forEach(issue => {
        const d = document.createElement('div')
        d.style.cssText = `color:${fg}; opacity:0.8; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:400;`
        d.textContent = issue.message
        badge.appendChild(d)
      })

      badge.style.visibility = 'hidden'
      container.appendChild(badge)
      const bw = badge.offsetWidth
      const bh = badge.offsetHeight

      let top      = absTop - bh - 6
      let left     = absLeft
      let arrowPos = 'bottom'

      if (top < 4) {
        top      = absBottom + 6
        arrowPos = 'top'
      }
      if (left + bw > window.innerWidth - 4) left = absRight - bw
      left = Math.max(4, left)
      top  = Math.max(4, top)

      // Sprechblasen-Pfeil
      const arrow = document.createElement('div')
      const arrowSize = 10
      arrow.style.cssText = `
        position:absolute;
        width:0; height:0;
        border-left:${arrowSize}px solid transparent;
        border-right:${arrowSize}px solid transparent;
        left:${Math.min(Math.max(absLeft - left + 12, arrowSize), bw - arrowSize * 2 - 4)}px;
        pointer-events:none;
      `
      if (arrowPos === 'bottom') {
        arrow.style.bottom = `-${arrowSize}px`
        arrow.style.borderTop = `${arrowSize}px solid ${color}`
      } else {
        arrow.style.top = `-${arrowSize}px`
        arrow.style.borderBottom = `${arrowSize}px solid ${color}`
      }
      badge.style.position = 'fixed'
      badge.appendChild(arrow)

      badge.style.top        = `${top}px`
      badge.style.left       = `${left}px`
      badge.style.visibility = 'visible'
    }

    function update() {
      container.innerHTML = ''
      items.forEach(item => {
        const hit = findElementFrontend(item.id) ?? findElementLiveEditor(item.id, item.meta ?? {})
        if (!hit) return
        renderBadge(hit, item)
      })
    }

    // Single: zum Element scrollen
    if (items.length === 1) {
      const item = items[0]
      const fe   = findElementFrontend(item.id)
      if (fe) {
        fe.el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        for (const iframe of document.querySelectorAll('iframe')) {
          try {
            const iDoc  = iframe.contentDocument
            const found = iDoc?.querySelector(`[data-${prefix}-id="${item.id}"]`)
                       ?? findByMeta(iDoc, item.meta ?? {})
            if (found) {
              found.scrollIntoView({ behavior: 'smooth', block: 'center' })
              break
            }
          } catch {}
        }
      }
    }

    window.__wpOverlayUpdate = update
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    window.__wpOverlayIframeCleanup = attachIframeScrollListeners(update)
    update()
  }
}

const hideScript = () => {
  document.getElementById('__wp-overlays')?.remove()
  window.removeEventListener('scroll', window.__wpOverlayUpdate)
  window.removeEventListener('resize', window.__wpOverlayUpdate)
  if (window.__wpOverlayIframeCleanup) {
    window.__wpOverlayIframeCleanup()
    delete window.__wpOverlayIframeCleanup
  }
  delete window.__wpOverlayUpdate
}

export function usePageOverlay() {
  const active       = ref(false)
  const { state }    = useCheckStore()

  // Aktiver Tab + gecheckte Tab (falls verschieden) → Sync Frontend ↔ Live Editor
  async function getTargetTabIds() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const ids = new Set()
    if (activeTab?.id)       ids.add(activeTab.id)
    if (state.checkedTabId)  ids.add(state.checkedTabId)
    return [...ids]
  }

  async function injectIntoTabs(func, args) {
    const tabIds = await getTargetTabIds()
    await Promise.all(tabIds.map(tabId =>
      chrome.scripting.executeScript({ target: { tabId }, func, args }).catch(() => {})
    ))
  }

  async function show(items) {
    await injectIntoTabs(buildOverlayScript(), [items, APP_NAME_LOWER])
    active.value = true
  }

  async function showSingle(item) {
    await injectIntoTabs(buildOverlayScript(), [[item], APP_NAME_LOWER])
    active.value = false
  }

  async function hide() {
    await injectIntoTabs(hideScript, [])
    active.value = false
  }

  async function toggle(items) {
    active.value ? hide() : show(items)
  }

  return { active, show, showSingle, hide, toggle }
}