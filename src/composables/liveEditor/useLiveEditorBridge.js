import { ref, watch } from 'vue'
import { useCheckStore } from '@/services/web-checker/composables/useCheckStore.js'
import { useAppConfig }  from '@/composables/useAppConfig.js'

const { state: appConfig } = useAppConfig()

function editorHostPatterns() {
  const cfg = appConfig.liveEditor
  const patterns = []
  if (cfg.cms4Staging)  { try { patterns.push(new RegExp(cfg.cms4Staging)) } catch {} }
  if (cfg.cms4ProdHost) { try { patterns.push(new RegExp(`^${cfg.cms4ProdHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)) } catch {} }
  return patterns
}

// CMS4 element types fall into two buckets:
//
//   CONTENT — editable whenever the audit element sits inside a wrapper of
//   this type (e.g. an <img> inside a <figure data-element-type="picture">).
//
//   STRUCTURAL — editable only when the audit element IS the wrapper itself.
//   A child sitting inside, say, <nav data-element-type="navigation"> is not
//   item-wise editable; but the nav block as a whole IS, so when the audit
//   element happens to be the navigation wrapper itself we still want the
//   button. Same goes for a <div data-element-type="container"> with a CSS
//   background image — that container is editable, but a random <span>
//   inside it isn't.
const CONTENT_TYPES = [
  'article', 'title', 'text', 'picture', 'button', 'html', 'file',
  'audio', 'video', 'logo', 'horizontalLine', 'imprint', 'gdpr',
  'imprintContent', 'gdprContent', 'contactForm', 'contactFormContent',
  'newsletter', 'accessManager', 'galleryImage',
]
const STRUCTURAL_TYPES = [
  'container', 'grid', 'column', 'navigation', 'gallery', 'newsfeed',
  'loopMaster', 'loopChild', 'loopPlaceholder', 'module',
]

function isEditorHost(host) {
  return editorHostPatterns().some(re => re.test(host))
}

async function findEditorTabFor(checkedUrl) {
  if (!checkedUrl) return null
  let auditDomain
  try { auditDomain = new URL(checkedUrl).hostname } catch { return null }

  let tabs
  try { tabs = await chrome.tabs.query({}) } catch { return null }

  for (const tab of tabs) {
    if (!tab.url) continue
    let url
    try { url = new URL(tab.url) } catch { continue }
    if (!isEditorHost(url.hostname)) continue

    if (appConfig.liveEditor.cms4ProdHost && url.hostname === appConfig.liveEditor.cms4ProdHost) {
      const m = url.pathname.match(/^\/website\/([^/]+)/)
      if (m && m[1] === auditDomain) return tab
      continue
    }

    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => window.leConfig?.website?.domain ?? null,
      })
      if (res?.result === auditDomain) return tab
    } catch {}
  }
  return null
}

async function openEditorFor(checkedUrl) {
  if (!checkedUrl) return null
  const base = appConfig.liveEditor.cms4ProdBase
  if (!base) return null
  let auditDomain
  try { auditDomain = new URL(checkedUrl).hostname } catch { return null }
  return chrome.tabs.create({ url: `${base}${auditDomain}/`, active: true })
}

// runs in the LE top-frame. Walks the iframe DOM, locates the audited element
// by metadata, scrolls it into view, and pulse-highlights it.
// Solid orange outline = editable in CMS4 (has data-le-eid ancestor of an
// editable type). Dashed grey = found but outside the LE-editable scope.
function focusInEditor(meta, contentTypes, structuralTypes) {
  const contentSet    = new Set(contentTypes)
  const structuralSet = new Set(structuralTypes)

  function findByMeta(doc, m) {
    if (m.selector) {
      try {
        const bySel = doc.querySelector(m.selector)
        if (bySel) return bySel
      } catch {}
    }
    if (m.tag !== undefined && m.idx !== undefined) {
      const byIdx = doc.querySelectorAll(m.tag)[m.idx] ?? null
      if (byIdx) return byIdx
    }
    if (m.text && m.tag) {
      const needle = m.text.trim().toLowerCase()
      const found = Array.from(doc.querySelectorAll(m.tag)).find(el =>
        (el.innerText || el.textContent || '').trim().toLowerCase().startsWith(needle)
      )
      if (found) return found
    }
    // Substring-match for spellcheck-style items: the audit-side selector
    // (`[data-${prefix}-ref="spellcheck-X"]`) doesn't exist in the LE iframe,
    // and tag+idx falls back to <body>. Locate by a context snippet — the
    // surrounding sentence around the misspelled word — with fehler as
    // last-resort fallback if the windowed context spans block boundaries.
    //
    // Whitespace is normalized on both sides because audit text uses
    // LanguageTool's collapsed single-spaces while the rendered DOM may have
    // &nbsp;, line breaks, or multiple spaces in equivalent positions.
    {
      const norm    = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      const needles = []
      if (m.contextText && m.contextText.length >= 8) needles.push(norm(m.contextText))
      if (m.fehler     && m.fehler.length     >= 3) needles.push(norm(m.fehler))
      // Prefer leaf-ish text containers over outer wrappers — go by tag order
      // so <p> wins over <section>. Apply each needle in turn — if the long
      // context-snippet doesn't match a leaf, try the bare fehler word.
      const tags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'blockquote', 'article', 'section']
      for (const needle of needles) {
        for (const tag of tags) {
          const blocks = doc.querySelectorAll(tag)
          for (const el of blocks) {
            const haystack = norm(el.innerText || el.textContent || '')
            if (haystack.includes(needle)) return el
          }
        }
      }
    }
    if (m.isBackground && m.idx !== undefined) {
      const bgEls  = Array.from(doc.querySelectorAll('[style*="background-image"]')).filter(el => el.tagName !== 'IMG')
      const cmsEls = Array.from(doc.querySelectorAll('[data-cms-src]:not(img)'))
      const seen   = new Set()
      const all    = [...bgEls, ...cmsEls].filter(el => seen.has(el) ? false : (seen.add(el), true))
      return all[m.idx] ?? null
    }
    if (m.src || m.name || m.alt) {
      const baseName = (m.name || m.src || '')
        .split('/').pop()
        .replace(/\.[^.]+$/, '')
        .replace(/_(small|medium|large|resized|x1|x2).*$/i, '')
      if (m.alt?.length > 3) {
        const byAlt = Array.from(doc.querySelectorAll('img')).find(img => img.getAttribute('alt') === m.alt)
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

  for (const iframe of document.querySelectorAll('iframe')) {
    let doc
    try { doc = iframe.contentDocument } catch { continue }
    if (!doc) continue

    const el = findByMeta(doc, meta || {})
    if (!el) continue

    const wrapper = el.closest('[data-le-eid]')
    const type    = wrapper?.getAttribute('data-element-type') ?? null
    const editable = !!wrapper && (
      contentSet.has(type) ||
      (structuralSet.has(type) && wrapper === el)
    )
    const target   = wrapper ?? el

    // The LE iframe sets `scroll-behavior: smooth` on <html>; bare scroll
    // attempts animate and the LE clobbers them mid-flight. Two extra layers
    // of defense:
    //  1) override scroll-behavior to auto on the iframe's html
    //  2) try every API in sequence (scrollTo on contentWindow, scrollTop
    //     assignment on documentElement+body, and finally scrollIntoView).
    //     One of them always lands.
    //  3) re-apply the scroll on the next two animation frames so any LE
    //     re-render can't undo it.
    const html = doc.documentElement
    const body = doc.body
    const prevBehavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    const win  = doc.defaultView
    const winH = win.innerHeight

    function applyScroll() {
      const rect    = target.getBoundingClientRect()
      const curY    = win.scrollY ?? html.scrollTop ?? 0
      const targetY = Math.max(0, curY + rect.top - winH / 2 + rect.height / 2)
      try { win.scrollTo({ top: targetY, behavior: 'instant' }) } catch {}
      try { html.scrollTop = targetY } catch {}
      try { body.scrollTop = targetY } catch {}
    }
    applyScroll()
    win.requestAnimationFrame(applyScroll)
    win.requestAnimationFrame(() => win.requestAnimationFrame(applyScroll))
    setTimeout(() => { html.style.scrollBehavior = prevBehavior }, 200)

    const prevOutline    = target.style.outline
    const prevOffset     = target.style.outlineOffset
    const prevTransition = target.style.transition
    target.style.outline       = editable ? '3px solid #f59e0b' : '3px dashed #94a3b8'
    target.style.outlineOffset = '4px'
    target.style.transition    = 'outline 0.25s'
    setTimeout(() => {
      target.style.outline       = prevOutline
      target.style.outlineOffset = prevOffset
      target.style.transition    = prevTransition
    }, 2200)

    return {
      ok: true,
      editable,
      type,
      eid: wrapper?.getAttribute('data-le-eid') ?? null,
    }
  }
  return { ok: false, reason: 'not-found' }
}

// runs in the LE top-frame. For each meta, returns true iff the element is
// found AND its closest data-le-eid wrapper has an editable element-type.
function batchResolveEditable(metas, contentTypes, structuralTypes) {
  const contentSet    = new Set(contentTypes)
  const structuralSet = new Set(structuralTypes)

  function findByMeta(doc, m) {
    if (m.selector) {
      try {
        const bySel = doc.querySelector(m.selector)
        if (bySel) return bySel
      } catch {}
    }
    if (m.tag !== undefined && m.idx !== undefined) {
      const byIdx = doc.querySelectorAll(m.tag)[m.idx] ?? null
      if (byIdx) return byIdx
    }
    if (m.text && m.tag) {
      const needle = m.text.trim().toLowerCase()
      const found = Array.from(doc.querySelectorAll(m.tag)).find(el =>
        (el.innerText || el.textContent || '').trim().toLowerCase().startsWith(needle)
      )
      if (found) return found
    }
    // Substring-match for spellcheck-style items: the audit-side selector
    // (`[data-${prefix}-ref="spellcheck-X"]`) doesn't exist in the LE iframe,
    // and tag+idx falls back to <body>. Locate by a context snippet — the
    // surrounding sentence around the misspelled word — with fehler as
    // last-resort fallback if the windowed context spans block boundaries.
    //
    // Whitespace is normalized on both sides because audit text uses
    // LanguageTool's collapsed single-spaces while the rendered DOM may have
    // &nbsp;, line breaks, or multiple spaces in equivalent positions.
    {
      const norm    = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      const needles = []
      if (m.contextText && m.contextText.length >= 8) needles.push(norm(m.contextText))
      if (m.fehler     && m.fehler.length     >= 3) needles.push(norm(m.fehler))
      // Prefer leaf-ish text containers over outer wrappers — go by tag order
      // so <p> wins over <section>. Apply each needle in turn — if the long
      // context-snippet doesn't match a leaf, try the bare fehler word.
      const tags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'blockquote', 'article', 'section']
      for (const needle of needles) {
        for (const tag of tags) {
          const blocks = doc.querySelectorAll(tag)
          for (const el of blocks) {
            const haystack = norm(el.innerText || el.textContent || '')
            if (haystack.includes(needle)) return el
          }
        }
      }
    }
    if (m.isBackground && m.idx !== undefined) {
      const bgEls  = Array.from(doc.querySelectorAll('[style*="background-image"]')).filter(el => el.tagName !== 'IMG')
      const cmsEls = Array.from(doc.querySelectorAll('[data-cms-src]:not(img)'))
      const seen   = new Set()
      const all    = [...bgEls, ...cmsEls].filter(el => seen.has(el) ? false : (seen.add(el), true))
      return all[m.idx] ?? null
    }
    if (m.src || m.name || m.alt) {
      const baseName = (m.name || m.src || '')
        .split('/').pop()
        .replace(/\.[^.]+$/, '')
        .replace(/_(small|medium|large|resized|x1|x2).*$/i, '')
      if (m.alt?.length > 3) {
        const byAlt = Array.from(doc.querySelectorAll('img')).find(img => img.getAttribute('alt') === m.alt)
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

  let doc = null
  for (const iframe of document.querySelectorAll('iframe')) {
    try { doc = iframe.contentDocument; if (doc) break } catch {}
  }
  if (!doc) return metas.map(() => false)

  return metas.map(m => {
    const el = findByMeta(doc, m || {})
    if (!el) return false
    const wrapper = el.closest('[data-le-eid]')
    if (!wrapper) return false
    const type = wrapper.getAttribute('data-element-type')
    if (contentSet.has(type)) return true
    if (structuralSet.has(type) && wrapper === el) return true
    return false
  })
}

const editorTab    = ref(null)
const editableMap  = ref(new Map())
const pendingItems = []
let pendingTimer   = null
let initialized    = false

function itemKey(item) {
  return `${item.element ?? ''}|${JSON.stringify(item._meta ?? {})}`
}

async function refreshEditorTab() {
  const { state } = useCheckStore()
  const next = await findEditorTabFor(state.checkedUrl)
  const prevId = editorTab.value?.id ?? null
  const nextId = next?.id ?? null
  // avoid triggering watchers when the same tab id is rediscovered (every
  // tab.onUpdated fires this; we only care about real identity changes).
  if (prevId === nextId && prevId !== null) return
  if (prevId === null && nextId === null) return
  editorTab.value = next
}

async function flushBatch() {
  pendingTimer = null
  if (pendingItems.length === 0) return
  const batch = pendingItems.splice(0)

  if (!editorTab.value) {
    const map = new Map(editableMap.value)
    for (const { keyText } of batch) map.set(keyText, false)
    editableMap.value = map
    return
  }

  const metas = batch.map(({ item }) => item._meta ?? {})
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: editorTab.value.id },
      func: batchResolveEditable,
      args: [metas, CONTENT_TYPES, STRUCTURAL_TYPES],
    })
    const results = res?.result ?? []
    const map = new Map(editableMap.value)
    batch.forEach(({ keyText }, i) => map.set(keyText, !!results[i]))
    editableMap.value = map
  } catch {
    const map = new Map(editableMap.value)
    for (const { keyText } of batch) map.set(keyText, false)
    editableMap.value = map
  }
}

function requestEditable(item) {
  const key = itemKey(item)
  if (editableMap.value.has(key)) return
  if (pendingItems.find(p => p.keyText === key)) return
  pendingItems.push({ keyText: key, item })
  if (!pendingTimer) pendingTimer = setTimeout(flushBatch, 50)
}

function getEditable(item) {
  return editableMap.value.get(itemKey(item))
}

function initOnce() {
  if (initialized) return
  initialized = true
  const { state } = useCheckStore()

  refreshEditorTab()
  watch(() => state.checkedUrl, () => {
    editableMap.value = new Map()
    pendingItems.length = 0
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
    refreshEditorTab()
  })

  // when the LE tab itself changes (opened/closed/different domain) the
  // cached editability is stale — drop it.
  watch(editorTab, () => {
    editableMap.value = new Map()
    pendingItems.length = 0
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
  })

  const onTabUpdated = (_tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) refreshEditorTab()
  }
  chrome.tabs?.onUpdated?.addListener(onTabUpdated)
  chrome.tabs?.onRemoved?.addListener(() => refreshEditorTab())
  chrome.tabs?.onCreated?.addListener(() => refreshEditorTab())
}

export function useLiveEditorBridge() {
  initOnce()

  async function focusItem(item) {
    if (!editorTab.value) return { ok: false, reason: 'no-editor' }
    try {
      await chrome.tabs.update(editorTab.value.id, { active: true })
      if (editorTab.value.windowId !== undefined) {
        try { await chrome.windows.update(editorTab.value.windowId, { focused: true }) } catch {}
      }
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: editorTab.value.id },
        func: focusInEditor,
        args: [item._meta ?? {}, CONTENT_TYPES, STRUCTURAL_TYPES],
      })
      return res?.result ?? { ok: false, reason: 'unknown' }
    } catch (e) {
      return { ok: false, reason: 'error', error: String(e) }
    }
  }

  async function openEditor() {
    const { state } = useCheckStore()
    return openEditorFor(state.checkedUrl)
  }

  return {
    editorTab,
    focusItem,
    refresh: refreshEditorTab,
    requestEditable,
    getEditable,
    openEditor,
  }
}
