import { APP_NAME_LOWER } from '@/config/app.js'

export const overlay   = null
export const apiConfig = { prefix: APP_NAME_LOWER }

export default async function check(config) {
  const t = window.__t

  // constants must live inside check() — chrome.scripting only serializes the function body
  const prefix            = config.prefix
  const SEO_OFFSET_MARKER = 2_000_000

  document.querySelectorAll(`[data-${prefix}-injected-wrap="spellcheck"], [data-${prefix}-injected="spellcheck"]`).forEach(span => {
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
  const url      = location.href

  const result = await runInBackground('CHECK_SPELLING', { text, url, domain, language, images })

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
    const arrow = m.korrektur && m.fehler?.trim() ? ` → ${m.korrektur}` : ''
    if (m.category) return `${m.category}${arrow}`
    if (arrow)      return arrow.replace(/^ /, '')
    return m.message
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

  function makeSpan(text, id) {
    const isWhitespace = !text.trim()
    const span = document.createElement('span')
    span.setAttribute(`data-${prefix}-injected`, 'spellcheck')
    span.setAttribute(`data-${prefix}-ref`, id)
    span.style.cssText = isWhitespace
      ? 'background:rgba(250,176,5,0.35);outline:1px dashed #f59f00;cursor:pointer;'
      : 'text-decoration:underline wavy #dc2626;text-decoration-skip-ink:none;cursor:pointer;'
    span.textContent = text
    return span
  }

  // single wrapper child preserves whitespace under flex/grid parents
  function applyRangesToNode(node, ranges) {
    if (!node.parentNode) return
    const fullText = node.textContent
    const sorted   = [...ranges].sort((a, b) => a.start - b.start)

    const wrapper = document.createElement('span')
    wrapper.setAttribute(`data-${prefix}-injected-wrap`, 'spellcheck')
    wrapper.style.cssText = 'display:inline;'

    let cursor = 0
    for (const r of sorted) {
      if (r.start < cursor) continue                  // overlap with previous span
      if (r.start > cursor) wrapper.appendChild(document.createTextNode(fullText.slice(cursor, r.start)))
      const sliceText = fullText.slice(r.start, r.end)
      wrapper.appendChild(makeSpan(sliceText, r.id))
      cursor = r.end
    }
    if (cursor < fullText.length) wrapper.appendChild(document.createTextNode(fullText.slice(cursor)))

    node.parentNode.replaceChild(wrapper, node)
  }

  function injectFallback(fehler, id) {
    if (!fehler?.trim()) return null
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const tag = node.parentElement?.tagName
        if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (node.parentElement?.closest?.(`[data-${prefix}-injected],[data-${prefix}-injected-wrap]`)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    while (walker.nextNode()) {
      const node = walker.currentNode
      const idx  = node.textContent.indexOf(fehler)
      if (idx === -1) continue
      applyRangesToNode(node, [{ start: idx, end: idx + fehler.length, id }])
      return node.parentElement
    }
    return null
  }

  const nodeMap = buildNodeMap()
  const elementMap = {}
  // group matches per text node so we split each node once in a single pass
  const rangesPerNode = new Map()

  matches.forEach((m, originalIndex) => {
    const id = `spellcheck-${originalIndex}`

    if (m.offset >= SEO_OFFSET_MARKER) {
      const byAlt = m.fehler
        ? Array.from(document.querySelectorAll('img')).find(img => img.getAttribute('alt') === m.fehler)
        : null
      elementMap[originalIndex] = byAlt ?? document.body
      return
    }

    const hit = nodeMap.find(e => e.start <= m.offset && m.offset < e.end)
    if (hit) {
      const localOffset = m.offset - hit.start
      const textSlice   = hit.node.textContent.slice(localOffset, localOffset + m.length)
      if (textSlice === m.fehler || textSlice.toLowerCase() === m.fehler.toLowerCase()) {
        if (!rangesPerNode.has(hit.node)) rangesPerNode.set(hit.node, { element: hit.element, ranges: [] })
        rangesPerNode.get(hit.node).ranges.push({ start: localOffset, end: localOffset + m.length, id })
        elementMap[originalIndex] = hit.element
        return
      }
    }

    elementMap[originalIndex] = injectFallback(m.fehler, id) ?? document.body
  })

  for (const [node, { ranges }] of rangesPerNode) {
    applyRangesToNode(node, ranges)
  }

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
        : {
            selector: `[data-${prefix}-ref="spellcheck-${i}"]`,
            tag: el.tagName, idx: tagIdx,
            // contextText + fehler together let the live-editor bridge find
            // the same paragraph in the LE iframe (where our injected ref
            // selector doesn't exist). The bridge tries contextText first
            // for uniqueness, then falls back to fehler — useful for short
            // errors at paragraph boundaries where the windowed context
            // spans multiple blocks.
            contextText: (() => {
              const fehler = m.fehler ?? ''
              if (fehler.length >= 12) return fehler
              const ctx       = m.context?.text ?? ''
              const ctxOffset = m.context?.offset ?? 0
              const ctxLength = m.context?.length ?? fehler.length
              const start     = Math.max(0, ctxOffset - 20)
              const end       = Math.min(ctx.length, ctxOffset + ctxLength + 20)
              const slice     = ctx.slice(start, end).trim()
              return slice.length >= 8 ? slice : fehler
            })(),
            fehler: m.fehler,
          },
    })
  })

  const r = finish()
  return { ...r, domain, slug: result?.slug ?? null }
}