import { onMounted, onUnmounted } from 'vue'
import { useCheckStore }  from './useCheckStore.js'
import { APP_NAME_LOWER } from '@/config/app.js'

export function useModuleAttributes(moduleId) {
  const { state } = useCheckStore()

  async function getTabIds() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const ids = new Set()
    if (activeTab?.id)      ids.add(activeTab.id)
    if (state.checkedTabId) ids.add(state.checkedTabId)
    return [...ids]
  }

  async function apply() {
    const result = state.results[moduleId]
    if (!result?.items?.length) return

    const payload = result.items.map(item => ({
      id:     item.element,
      meta:   item._meta   ?? {},
      type:   item.type    ?? 'success',
      issues: (item.issues ?? []).map(i => ({ type: i.type, message: i.message })),
    }))

    const tabIds = await getTabIds()
    await Promise.all(tabIds.map(tabId =>
      chrome.scripting.executeScript({
        target: { tabId },
        func: (payload, moduleId, prefix) => {

          // Bestehende Attribute entfernen
          document.querySelectorAll(`[data-${prefix}-id]`).forEach(el => {
            el.removeAttribute(`data-${prefix}-id`)
            el.removeAttribute(`data-${prefix}-module`)
            el.removeAttribute(`data-${prefix}-type`)
            el.removeAttribute(`data-${prefix}-meta`)
            el.removeAttribute(`data-${prefix}-title`)
            el.removeAttribute(`data-${prefix}-desc`)
          })

          /**
           * Element per _meta finden.
           *
           * Priorität:
           * 1. meta.selector → direkter CSS-Selektor
           *    Für Module, die eigene Spans in den DOM injizieren (z.B. Spellcheck).
           * 2. meta.tag + meta.idx → n-tes Element des Tag-Typs
           * 3. meta.text + meta.tag → Text-Fallback
           * 4. meta.src / meta.name / meta.alt → Bilder
           */
          function findEl(meta) {
            if (meta.selector) {
              return document.querySelector(meta.selector) ?? null
            }

            if (meta.tag !== undefined && meta.idx !== undefined) {
              return document.querySelectorAll(meta.tag)[meta.idx] ?? null
            }

            if (meta.text && meta.tag) {
              const needle = meta.text.trim().toLowerCase()
              return Array.from(document.querySelectorAll(meta.tag)).find(el =>
                (el.innerText || el.textContent || '').trim().toLowerCase().startsWith(needle)
              ) ?? null
            }

            if (meta.src || meta.name || meta.alt) {
              const baseName = (meta.name || meta.src || '')
                .split('/').pop()
                .replace(/\.[^.]+$/, '')
                .replace(/_(small|medium|large|resized|x1|x2).*$/i, '')

              if (meta.alt?.length > 3) {
                const byAlt = document.querySelector(`img[alt="${meta.alt}"]`)
                if (byAlt) return byAlt
              }

              if (baseName) {
                return Array.from(document.querySelectorAll('img')).find(img =>
                  (img.getAttribute('src')              ?? '').includes(baseName) ||
                  (img.getAttribute('data-src')         ?? '').includes(baseName) ||
                  (img.getAttribute('data-pic-cms-src') ?? '').includes(baseName)
                ) ?? null
              }
            }

            return null
          }

          payload.forEach(item => {
            const el = findEl(item.meta)
            if (!el) return

            const topIssue = item.issues.find(i => i.type !== 'success')
            const desc     = item.issues.map(i => i.message).join(' · ')

            el.setAttribute(`data-${prefix}-id`,     item.id)
            el.setAttribute(`data-${prefix}-module`, moduleId)
            el.setAttribute(`data-${prefix}-type`,   item.type)
            el.setAttribute(`data-${prefix}-meta`,   JSON.stringify(item.meta))
            if (topIssue) el.setAttribute(`data-${prefix}-title`, topIssue.message)
            if (desc)     el.setAttribute(`data-${prefix}-desc`,  desc)
          })
        },
        args: [payload, moduleId, APP_NAME_LOWER],
      }).catch(() => {})
    ))
  }

  async function remove() {
    const tabIds = await getTabIds()
    await Promise.all(tabIds.map(tabId =>
      chrome.scripting.executeScript({
        target: { tabId },
        func: (moduleId, prefix) => {
          // Attribute von bestehenden Elementen entfernen
          document.querySelectorAll(`[data-${prefix}-module="${moduleId}"]`).forEach(el => {
            el.removeAttribute(`data-${prefix}-id`)
            el.removeAttribute(`data-${prefix}-module`)
            el.removeAttribute(`data-${prefix}-type`)
            el.removeAttribute(`data-${prefix}-meta`)
            el.removeAttribute(`data-${prefix}-title`)
            el.removeAttribute(`data-${prefix}-desc`)
          })

          document.querySelectorAll(`[data-${prefix}-injected="${moduleId}"]`).forEach(span => {
            const parent = span.parentNode
            if (!parent) return
            parent.replaceChild(document.createTextNode(span.textContent), span)
            parent.normalize()
          })
        },
        args: [moduleId, APP_NAME_LOWER],
      }).catch(() => {})
    ))
  }

  onMounted(() => apply())
  onUnmounted(() => remove())
}