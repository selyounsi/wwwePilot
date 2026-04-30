import { APP_NAME_LOWER } from '@/config/app.js'

export const overlay   = null
export const apiConfig = { prefix: APP_NAME_LOWER }

export default async function check(config) {
  const t = window.__t

  // constants must live inside check() — chrome.scripting only serializes the function body
  const prefix            = config.prefix
  const SEO_OFFSET_MARKER = 2_000_000

  document.querySelectorAll(`[data-${prefix}-injected="spellcheck"]`).forEach(span => {
    const parent = span.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(span.textContent), span)
    parent.normalize()
  })

  const text = document.body.innerText?.trim()
  if (!text) {
    return { errors: [{ message: t('No text found') }], warnings: [], errorCount: 1, warningCount: 0, items: [] }
  }

  const images = Array.from(document.querySelectorAll('img')).map(img => ({
    alt:   img.getAttribute('alt')   ?? '',
    src:   img.getAttribute('src')   ?? img.getAttribute('data-src') ?? '',
    title: img.getAttribute('title') ?? '',
  }))

  const domain   = location.hostname
  const language = document.documentElement.lang?.slice(0, 5) || 'de-DE'

  const result = await runInBackground('CHECK_SPELLING', { text, domain, language, images })

  if (result?.error) {
    return { errors: [{ message: result.error }], warnings: [], errorCount: 1, warningCount: 0, items: [] }
  }

  // Drop matches whose offending word is on the user's ignore list
  // (configured via Spellcheck → Settings).
  const ignoreWords = (window.__moduleSettings?.spellcheck?.ignoreWords ?? []).map(w => w.toLowerCase())
  const matches = (result?.matches ?? []).filter(m => {
    const word = (m.fehler ?? '').trim().toLowerCase()
    return !word || !ignoreWords.includes(word)
  })
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  function severityToType(severity) {
    return severity === 'error' ? 'error' : 'warning'
  }

  function issueTitle(m) {
    if (!m.fehler?.trim()) return m.message
    if (!m.korrektur)      return m.message
    return `→ ${m.korrektur}`
  }

  function blockAncestor(el) {
    let cur = el
    while (cur && cur !== document.body) {
      const d = window.getComputedStyle(cur).display
      if (d !== 'inline' && d !== 'inline-block' && d !== 'inline-flex' &&
          d !== 'inline-grid' && d !== 'contents') return cur
      cur = cur.parentElement
    }
    return document.body
  }

  function buildNodeMap() {
    const entries = []
    let pos = 0
    let prevBlock = null

    const walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const tag = node.parentElement?.tagName
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(tag)) return NodeFilter.FILTER_REJECT
          const style = window.getComputedStyle(node.parentElement)
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT
          if (!node.textContent) return NodeFilter.FILTER_SKIP
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    while (walker.nextNode()) {
      const node  = walker.currentNode
      const el    = node.parentElement
      const block = blockAncestor(el)
      if (prevBlock && block !== prevBlock) pos++
      prevBlock = block
      const len = node.textContent.length
      entries.push({ node, element: el, start: pos, end: pos + len })
      pos += len
    }

    return entries
  }

  function injectAtNode(node, localOffset, length, id) {
    const fullText = node.textContent
    const start    = Math.max(0, localOffset)
    const end      = Math.min(fullText.length, start + length)
    if (start >= end) return

    const sliceText    = fullText.slice(start, end)
    const isWhitespace = !sliceText.trim()

    const span = document.createElement('span')
    span.setAttribute(`data-${prefix}-injected`, 'spellcheck')
    span.setAttribute(`data-${prefix}-ref`, id)
    span.style.cssText = isWhitespace
      ? 'background:rgba(250,176,5,0.35);outline:1px dashed #f59f00;cursor:pointer;'
      : 'text-decoration:underline wavy #dc2626;text-decoration-skip-ink:none;cursor:pointer;'
    span.textContent = sliceText

    const parent = node.parentNode
    const before = fullText.slice(0, start)
    const after  = fullText.slice(end)
    if (before) parent.insertBefore(document.createTextNode(before), node)
    parent.insertBefore(span, node)
    if (after)  parent.insertBefore(document.createTextNode(after), node)
    parent.removeChild(node)
  }

  function injectFallback(fehler, id) {
    if (!fehler?.trim()) return null
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const tag = node.parentElement?.tagName
        if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(tag)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    while (walker.nextNode()) {
      const node = walker.currentNode
      const idx  = node.textContent.indexOf(fehler)
      if (idx === -1) continue
      injectAtNode(node, idx, fehler.length, id)
      return node.parentElement
    }
    return null
  }

  const nodeMap = buildNodeMap()

  // sort descending so DOM splits from earlier injections don't shift later offsets
  const orderedMatches = matches
    .map((m, originalIndex) => ({ ...m, originalIndex }))
    .sort((a, b) => b.offset - a.offset)

  const elementMap = {}

  orderedMatches.forEach(m => {
    const id = `spellcheck-${m.originalIndex}`

    // SEO/image issues are tagged with offset >= marker; resolve target via alt attribute
    if (m.offset >= SEO_OFFSET_MARKER) {
      elementMap[m.originalIndex] = m.fehler
        ? (document.querySelector(`img[alt="${m.fehler}"]`) ?? document.body)
        : document.body
      return
    }

    const hit = nodeMap.find(e => e.start <= m.offset && m.offset < e.end)
    if (hit) {
      const localOffset = m.offset - hit.start
      const textSlice   = hit.node.textContent.slice(localOffset, localOffset + m.length)
      if (textSlice === m.fehler || textSlice.toLowerCase() === m.fehler.toLowerCase()) {
        injectAtNode(hit.node, localOffset, m.length, id)
        elementMap[m.originalIndex] = hit.element
        return
      }
    }

    // fallback: text-based lookup
    elementMap[m.originalIndex] = injectFallback(m.fehler, id) ?? document.body
  })

  // emit items in the original match order to keep the UI stable
  matches.forEach((m, i) => {
    const el    = elementMap[i] ?? document.body
    const type  = severityToType(m.severity)
    const isSeo = m.offset >= SEO_OFFSET_MARKER
    const tagIdx = el !== document.body && el.tagName
      ? Array.from(document.querySelectorAll(el.tagName)).indexOf(el)
      : -1

    addItem(el, [
      {
        when:        true,
        type,
        title:       issueTitle(m),
        description: m.message,
      }
    ], {
      id:          `spellcheck-${i}`,
      fehler:      m.fehler,
      korrektur:   m.korrektur,
      message:     m.message,
      category:    m.category ?? t('Other'),
      suggestions: m.suggestions ?? [],
      context:     m.context?.text ?? '',
      ruleId:      m.ruleId ?? '',
      severity:    m.severity,
      isSeo,
      _meta: isSeo
        ? { alt: m.fehler, src: '', name: '' }
        : { selector: `[data-${prefix}-ref="spellcheck-${i}"]`, tag: el.tagName, idx: tagIdx },
    })
  })

  const r = finish()
  return { ...r, domain, slug: result?.slug ?? null }
}