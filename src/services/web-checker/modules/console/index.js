export const overlay = null

export default function check() {
  const t = window.__t
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  const captured = window.__capturedConsole

  if (!Array.isArray(captured)) {
    warnings.push({ message: t('Capture not active — reload the page to enable console-capture') })
    return finish()
  }

  captured.forEach((entry, idx) => {
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

  return finish()
}
