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

    // strip trailing slash, /index suffix, and 2-letter language prefix like /de/, /en/
    function normalizePath(path) {
      return path
        .replace(/\/$/, '')
        .replace(/\/index$/, '')
        .replace(/^\/[a-z]{2}(\/|$)/, '/')
        .replace(/\/$/, '')
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