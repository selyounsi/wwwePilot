import { useModuleLoader }   from '@/composables/loaders/useModuleLoader.js'
import { useCheckRunner }    from './useCheckRunner.js'
import { moduleAppliesTo }   from './useUrlFilter.js'
import { useSiteCheckStore } from './useSiteCheckStore.js'

export function useSiteCheck() {
  const { modules }                  = useModuleLoader('web-checker')
  const { injectHelper, runChecker } = useCheckRunner()
  const store                        = useSiteCheckStore()

  async function loadPreflight(origin, sitemapUrl) {
    store.startFetching(origin)
    const reply = await sendMessage({ type: 'FETCH_SITEMAP', origin, sitemapUrl })
    if (reply?.error) {
      store.setError(reply.error, reply.code, reply.sitemapUrl)
      return
    }
    store.setUrls(reply?.urls ?? [])
    store.setSitemapUrl(reply?.sitemapUrl ?? null)
    store.enterPreflight()
  }

  async function start() {
    store.clearCancel()

    const allUrls       = store.state.urls
    const selectedUrls  = allUrls.filter(u => store.isUrlSelected(u))
    if (selectedUrls.length === 0) {
      store.setError('Keine Seiten ausgewählt — bitte mindestens eine wählen.')
      return
    }
    const selectedModuleIds = new Set(modules.filter(m => store.isModuleSelected(m.id)).map(m => m.id))
    if (selectedModuleIds.size === 0) {
      store.setError('Keine Module ausgewählt — bitte mindestens eines wählen.')
      return
    }

    for (const url of allUrls) {
      if (selectedUrls.includes(url)) continue
      for (const m of modules) {
        store.setUrlResult(url, m.id, { status: 'skipped', errorCount: 0, warningCount: 0, items: [] })
      }
    }

    store.startRunning()

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const checkTab = await chrome.tabs.create({
      url:    'about:blank',
      active: false,
      pinned: true,
      index:  (activeTab?.index ?? 0) + 1,
    })
    store.setCheckTabId(checkTab.id)

    const onTabRemoved = (tabId) => {
      if (tabId !== checkTab.id) return
      store.requestCancel()
      store.setError('Der Prüfungs-Tab wurde geschlossen — die Prüfung wurde abgebrochen.')
    }
    chrome.tabs.onRemoved.addListener(onTabRemoved)

    try {
      for (let i = 0; i < selectedUrls.length; i++) {
        if (store.state.cancelled) break

        while (store.state.status === 'paused' && !store.state.cancelled) {
          await sleep(200)
        }
        if (store.state.cancelled) break

        const url = selectedUrls[i]
        store.setCurrent(url, i)

        try {
          // register the load listener before navigation to not miss a fast 'complete'
          const completion = waitForComplete(checkTab.id)
          await chrome.tabs.update(checkTab.id, { url })
          await completion
          if (store.state.cancelled) break
          await sleep(800)

          await injectHelper(checkTab.id)

          const applicable = modules.filter(mod =>
            selectedModuleIds.has(mod.id) && moduleAppliesTo(mod, url, 'fullSite'),
          )

          modules.filter(m => !applicable.includes(m)).forEach(m => {
            store.setUrlResult(url, m.id, { status: 'skipped', errorCount: 0, warningCount: 0, items: [] })
          })

          store.setRunningModules(applicable.map(m => m.id))

          await Promise.all(applicable.map(async mod => {
            try {
              const [res] = await runChecker(checkTab.id, mod)
              store.setUrlResult(url, mod.id, { status: 'done', ...(res.result ?? { errors: [], warnings: [], errorCount: 0, warningCount: 0, items: [] }) })
            } catch (e) {
              store.setUrlResult(url, mod.id, { status: 'done', errors: [{ message: e.message }], warnings: [], errorCount: 1, warningCount: 0, items: [] })
            } finally {
              store.markModuleDone(mod.id)
            }
          }))
        } catch (e) {
          store.setUrlResult(url, '__page__', { status: 'error', error: e.message, errorCount: 0, warningCount: 0, items: [] })
        }
      }
    } finally {
      chrome.tabs.onRemoved.removeListener(onTabRemoved)
      try { await chrome.tabs.remove(checkTab.id) } catch {}
      store.setCheckTabId(null)
      if (store.state.status !== 'error') store.finish()
    }
  }

  async function highlightCheckTab() {
    const id = store.state.checkTabId
    if (!id) return
    try {
      const tab = await chrome.tabs.get(id)
      if (!tab) return
      await chrome.tabs.update(id, { active: true })
      if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true })
    } catch {}
  }

  function pause()  { if (store.state.status === 'running') store.setPaused(true)  }
  function resume() { if (store.state.status === 'paused')  store.setPaused(false) }
  function cancel() { store.requestCancel() }

  return { loadPreflight, start, pause, resume, cancel, highlightCheckTab, store }
}

function sendMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve))
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function waitForComplete(tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(updateListener)
      chrome.tabs.onRemoved.removeListener(removeListener)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Tab-Load Timeout (${timeoutMs}ms)`))
    }, timeoutMs)
    const updateListener = (id, info) => {
      if (id !== tabId) return
      if (info.status === 'complete') {
        cleanup()
        resolve()
      }
    }
    const removeListener = (id) => {
      if (id !== tabId) return
      cleanup()
      reject(new Error('Prüfungs-Tab wurde geschlossen'))
    }
    chrome.tabs.onUpdated.addListener(updateListener)
    chrome.tabs.onRemoved.addListener(removeListener)
  })
}
