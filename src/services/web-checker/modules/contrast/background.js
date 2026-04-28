export const type = 'CONTRAST_SAMPLE_BG'

// captures the visible tab and samples each rect, excluding pixels close to
// the text colour so we get the real background under the glyphs.
export async function handle(msg, sendResponse) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' })
    const blob    = await (await fetch(dataUrl)).blob()
    const bitmap  = await createImageBitmap(blob)
    const canvas  = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx     = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0)

    const dpr = bitmap.width / msg.viewportWidth

    const colors = msg.targets.map(target => {
      try {
        const x = Math.max(0, Math.floor(target.rect.x * dpr))
        const y = Math.max(0, Math.floor(target.rect.y * dpr))
        const w = Math.min(bitmap.width  - x, Math.floor(target.rect.width  * dpr))
        const h = Math.min(bitmap.height - y, Math.floor(target.rect.height * dpr))
        if (w <= 0 || h <= 0) return null

        const data = ctx.getImageData(x, y, w, h).data
        const fg   = target.fg
        let r = 0, g = 0, b = 0, count = 0

        // Sample every Nth pixel to keep it fast on large rects
        const step = Math.max(1, Math.floor(Math.sqrt(data.length / 4 / 5000)))
        for (let i = 0; i < data.length; i += 4 * step) {
          if (data[i + 3] < 128) continue
          const pr = data[i], pg = data[i + 1], pb = data[i + 2]
          const dist = Math.sqrt((pr - fg.r) ** 2 + (pg - fg.g) ** 2 + (pb - fg.b) ** 2)
          if (dist < 60) continue // skip pixels close to text colour
          r += pr; g += pg; b += pb; count++
        }

        if (count === 0) return null
        return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) }
      } catch { return null }
    })

    sendResponse({ colors })
  } catch (e) {
    sendResponse({ error: e.message, colors: [] })
  }
}
