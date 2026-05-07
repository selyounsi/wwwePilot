import { APP_NAME_LOWER } from './config/app.js'

const moduleHandlers  = import.meta.glob('./services/*/modules/*/background.js', { eager: true })
const serviceHandlers = import.meta.glob('./services/*/background.js',            { eager: true })
const handlerModules  = { ...moduleHandlers, ...serviceHandlers }

const handlerMap = {}
for (const [path, mod] of Object.entries(handlerModules)) {
  try {
    const types = Array.isArray(mod.types) ? mod.types : mod.type ? [mod.type] : []
    for (const t of types) {
      handlerMap[t] = mod.handle
      console.log(`[background] handler registered: ${t} (${path})`)
    }
  } catch (e) {
    console.error(`[background] handler error in ${path}:`, e)
  }
}

console.log('[background] registered handlers:', Object.keys(handlerMap))

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// register MAIN-world content-script via API — bypasses page CSP and the
// crxjs HMR loader, hooks console.* before any page script runs
;(async () => {
  try {
    const id  = 'console-capture'
    const cur = await chrome.scripting.getRegisteredContentScripts({ ids: [id] }).catch(() => [])
    const def = {
      id,
      matches:   ['<all_urls>'],
      js:        ['console-capture.js'],
      runAt:     'document_start',
      world:     'MAIN',
      allFrames: false,
    }
    if (cur.length) await chrome.scripting.updateContentScripts([def])
    else            await chrome.scripting.registerContentScripts([def])
  } catch (e) {
    console.error('[background] failed to register console-capture:', e)
  }
})()

// strip overlays + listeners injected by modules when sidebar disconnects
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'sidebar') return

  port.onDisconnect.addListener(async () => {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (prefix) => {
            document.getElementById('__wp-overlays')?.remove()
            document.getElementById('__wp-single')?.remove()
            ;[document, ...Array.from(document.querySelectorAll('iframe')).map(f => { try { return f.contentDocument } catch { return null } }).filter(Boolean)]
              .forEach(doc => doc.querySelectorAll(`[data-${prefix}-highlight]`).forEach(el => {
                el.style.outline = ''
                el.style.outlineOffset = ''
                el.removeAttribute(`data-${prefix}-highlight`)
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
          args: [APP_NAME_LOWER],
        })
      } catch {}
    }
  })
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlerMap[msg.type]
  if (!handler) return

  Promise.resolve()
    .then(() => handler(msg, sendResponse, sender))
    .catch(e => {
      console.error(`[background] handler ${msg.type} error:`, e)
      sendResponse({ error: e.message })
    })

  return true // async response
})