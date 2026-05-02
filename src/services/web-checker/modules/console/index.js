export const overlay = null

export default async function check() {
  const t = window.__t
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const captured = window.__capturedConsole
  const network  = await runInBackground('GET_NETWORK_ERRORS') || []

  if (!Array.isArray(captured) && network.length === 0) {
    warnings.push({ message: t('Capture not active — reload the page to enable console-capture') })
    return finish()
  }

  ;(captured || []).forEach((entry, idx) => {
    const isError = entry.type === 'error'
    addItem(document.documentElement, [
      {
        when:        true,
        type:        isError ? 'error' : 'warning',
        title:       isError ? t('Console error') : t('Console warning'),
        description: entry.message,
      },
    ], {
      message:   entry.message,
      source:    entry.source,
      timestamp: entry.timestamp,
      stack:     entry.stack,
      name:      entry.message?.slice(0, 120) || '(empty)',
      details:   t('Source: {source}', { source: entry.source }),
      visible:   true,
      _meta:     { idx },
    })
  })

  network.forEach((entry, idx) => {
    const code  = entry.error || 'unknown'
    const tag   = (entry.type || 'net').toUpperCase()
    addItem(document.documentElement, [
      {
        when:        true,
        type:        'error',
        title:       t('Network error: {code}', { code }),
        description: `${entry.method} ${entry.url}`,
      },
    ], {
      message:      `${code}: ${entry.url}`,
      source:       'network',
      timestamp:    entry.timestamp,
      url:          entry.url,
      method:       entry.method,
      resourceType: entry.type,
      errorCode:    code,
      name:         `[${tag}] ${code}`,
      details:      entry.url,
      visible:      true,
      _meta:        { idx: 'net-' + idx },
    })
  })

  return finish()
}
