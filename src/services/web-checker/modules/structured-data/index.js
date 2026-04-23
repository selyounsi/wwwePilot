export const checkOnReload = false
export const allowChatBot  = false
export const overlay       = null

export default async function check() {
  const head = document.head

  const jsonLdBlocks = []
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { jsonLdBlocks.push(JSON.parse(s.textContent)) } catch {}
  })

  const { addItem, finish } = createCheckResult()

  async function checkSchemaImage(block) {
    const raw = block.image
    if (!raw) return { url: null, reachable: null, width: 0, height: 0 }

    const rawUrl = typeof raw === 'string' ? raw : (raw.url || raw['@id'] || '')
    if (!rawUrl) return { url: null, reachable: null, width: 0, height: 0 }

    let url
    try { url = new URL(rawUrl, document.baseURI).href }
    catch { return { url: rawUrl, reachable: false, width: 0, height: 0 } }

    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'reload' })
      if (!res.ok) return { url, reachable: false, width: 0, height: 0 }
    } catch {
      return { url, reachable: false, width: 0, height: 0 }
    }

    const dims = await new Promise(resolve => {
      const img = new Image()
      img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 0, height: 0 })
      img.crossOrigin = 'anonymous'
      img.src = url
    })

    return { url, reachable: true, ...dims }
  }

  if (jsonLdBlocks.length === 0) {
    addItem(head, [
      { when: true, type: 'warning', title: 'Keine strukturierten Daten (JSON-LD) gefunden' },
    ], { id: 'no-json-ld', name: 'Keine JSON-LD Daten', details: '', category: 'JSON-LD', visible: true, _meta: { schema: null, image: null } })
  } else {
    await Promise.all(jsonLdBlocks.map(async (block, i) => {
      const rawType = block['@type']
      const typeStr = Array.isArray(rawType) ? rawType.join(', ') : (rawType || 'Unbekannt')

      const imgInfo  = await checkSchemaImage(block)
      const filename = imgInfo.url ? imgInfo.url.split('/').pop().split('?')[0] : ''
      const isSocialBranding = filename.toLowerCase().includes('social_branding')

      addItem(head, [
        { when: !!imgInfo.url && imgInfo.reachable === false,
          type: 'error', title: `Bild nicht erreichbar: ${filename || imgInfo.url}` },
        { when: isSocialBranding && imgInfo.reachable === true && (imgInfo.width < 250 || imgInfo.height < 250),
          type: 'error', title: `social_branding zu klein: ${imgInfo.width}×${imgInfo.height}px (min. 250×250)` },
      ], {
        id:       `schema-${i}`,
        name:     typeStr,
        details:  imgInfo.url && imgInfo.reachable ? `${imgInfo.width}×${imgInfo.height}px` : '',
        category: 'JSON-LD',
        visible:  true,
        _meta:    { schema: block, image: imgInfo },
      })
    }))
  }

  return finish()
}
