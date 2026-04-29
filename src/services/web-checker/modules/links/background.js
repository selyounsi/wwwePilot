export const type = 'CHECK_LINKS'

export async function handle(msg, sendResponse) {
  const results = await Promise.all(
    msg.urls.map(async (url) => {
      if (!url) return { url, broken: false }
      try {
        const u = new URL(url)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return { url, broken: false }
      } catch { return { url, broken: false } }

      const baseOpts = { redirect: 'follow', cache: 'no-store' }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let res = await fetch(url, { ...baseOpts, method: 'HEAD', signal: AbortSignal.timeout(10_000) })
          // some CDNs return 4xx for HEAD even when GET works — fall back
          if (res.status >= 400 && res.status !== 999) {
            res = await fetch(url, { ...baseOpts, method: 'GET', signal: AbortSignal.timeout(15_000) })
          }
          return { url, broken: res.status >= 400 && res.status !== 999 }
        } catch (e) {
          if (attempt === 0) { await new Promise(r => setTimeout(r, 500)); continue }
          return { url, broken: true }
        }
      }
    })
  )
  sendResponse(results)
}
