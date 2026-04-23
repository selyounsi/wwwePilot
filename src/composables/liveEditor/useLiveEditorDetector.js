export async function detectLiveEditor(tabId, checkedUrl) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const scripts = Array.from(document.querySelectorAll('script:not([src])'))
        for (const script of scripts) {
          const text = script.textContent
          if (!text.includes('leConfig')) continue
          const domain      = text.match(/leConfig\.website\.domain\s*=\s*["']([^"']+)["']/)?.[1]
          const pagePath    = text.match(/leConfig\.pagePath\s*=\s*["']([^"']+)["']/)?.[1]
          const pagePathUrl = text.match(/leConfig\.pagePathUrl\s*=\s*["']([^"']+)["']/)?.[1]
          const pageName    = text.match(/leConfig\.pageName\s*=\s*["']([^"']+)["']/)?.[1]
          if (domain) return { domain, pagePath: pagePath ?? '', pagePathUrl: pagePathUrl ?? '', pageName: pageName ?? '' }
        }
        return null
      },
    })

    const le = res?.result
    if (!le) return null

    const checkedDomain = new URL(checkedUrl).hostname
    if (le.domain !== checkedDomain) return 'editor-domain-mismatch'

    // Normalisiert einen Pfad:
    // - Trailing slash entfernen
    // - /index am Ende entfernen
    // - Sprachprefix (/de/, /en/, /fr/ etc.) entfernen
    function normalizePath(path) {
      return path
        .replace(/\/$/, '')              // trailing slash: /foo/ → /foo
        .replace(/\/index$/, '')         // /index suffix: /foo/index → /foo
        .replace(/^\/[a-z]{2}(\/|$)/, '/') // sprachprefix: /de/foo → /foo, /de → /
        .replace(/\/$/, '')              // nochmal trailing slash falls entstanden
        || '/'
    }

    const leRawPath      = le.pagePathUrl
      ? new URL(le.pagePathUrl).pathname
      : le.pagePath

    const lePath      = normalizePath(leRawPath)
    const checkedPath = normalizePath(new URL(checkedUrl).pathname)

    if (lePath === checkedPath) return 'editor-match'
    return 'editor-page-mismatch'

  } catch {
    return null
  }
}