export const type = 'CHECK_LINKS'

export async function handle(msg, sendResponse) {
  const results = await Promise.all(
    msg.urls.map(async (url) => {
      if (!url) return { url, broken: false }
      try {
        const opts = { signal: AbortSignal.timeout(5000), redirect: 'follow' }
        const res  = await fetch(url, { ...opts, method: 'HEAD' })
        if (res.status < 400 || res.status === 999) return { url, broken: false }
        const res2 = await fetch(url, { ...opts, method: 'GET', signal: AbortSignal.timeout(8000) })
        return { url, broken: res2.status >= 400 && res2.status !== 999 }
      } catch {
        return { url, broken: true }
      }
    })
  )
  sendResponse(results)
}