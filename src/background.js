// ── Handler automatisch aus allen Modulen & Services laden ───────────────
const moduleHandlers  = import.meta.glob('./services/*/modules/*/background.js', { eager: true })
const serviceHandlers = import.meta.glob('./services/*/background.js',            { eager: true })
const handlerModules  = { ...moduleHandlers, ...serviceHandlers }

const handlerMap = {}
for (const [path, mod] of Object.entries(handlerModules)) {
  try {
    const types = Array.isArray(mod.types) ? mod.types : mod.type ? [mod.type] : []
    for (const t of types) {
      handlerMap[t] = mod.handle
      console.log(`[background] Handler registriert: ${t} (${path})`)
    }
  } catch (e) {
    console.error(`[background] Handler-Fehler in ${path}:`, e)
  }
}

console.log('[background] Registrierte Handler:', Object.keys(handlerMap))

// ── Sidebar öffnen ────────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// ── Cleanup beim Schließen der Sidebar ────────────────────────
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'sidebar') return

  port.onDisconnect.addListener(async () => {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            document.getElementById('__wp-overlays')?.remove()
            document.getElementById('__wp-single')?.remove()
            ;[document, ...Array.from(document.querySelectorAll('iframe')).map(f => { try { return f.contentDocument } catch { return null } }).filter(Boolean)]
              .forEach(doc => doc.querySelectorAll('[data-wwwebar-highlight]').forEach(el => {
                el.style.outline = ''
                el.style.outlineOffset = ''
                el.removeAttribute('data-wwwebar-highlight')
              }))
            window.removeEventListener('scroll', window.__wpOverlayUpdate)
            window.removeEventListener('resize', window.__wpOverlayUpdate)
            window.removeEventListener('scroll', window.__wpSingleUpdate)
            window.removeEventListener('resize', window.__wpSingleUpdate)
            if (window.__wpOverlayIframeCleanup) { window.__wpOverlayIframeCleanup(); delete window.__wpOverlayIframeCleanup }
            if (window.__wpSingleIframeCleanup)  { window.__wpSingleIframeCleanup();  delete window.__wpSingleIframeCleanup  }
            delete window.__wpOverlayUpdate
            delete window.__wpSingleUpdate
          },
        })
      } catch {}
    }
  })
})

// ── Message Router ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlerMap[msg.type]
  if (!handler) return

  Promise.resolve()
    .then(() => handler(msg, sendResponse))
    .catch(e => {
      console.error(`[background] Handler ${msg.type} Fehler:`, e)
      sendResponse({ error: e.message })
    })

  return true // async response
})