;(function () {
  if (window.__capturedConsole) return
  window.__capturedConsole = []

  const MAX = 500
  const orig = { error: console.error, warn: console.warn }

  function format(args) {
    try {
      return args.map(a => {
        if (typeof a === 'string')   return a
        if (a instanceof Error)      return a.stack || a.message
        try { return JSON.stringify(a) } catch { return String(a) }
      }).join(' ')
    } catch { return '[unserializable]' }
  }

  function record(type, message, source, stack) {
    if (window.__capturedConsole.length >= MAX) return
    window.__capturedConsole.push({ type, message, source, stack: stack || null, timestamp: Date.now() })
  }

  console.error = function (...args) { record('error', format(args), 'console'); return orig.error.apply(console, args) }
  console.warn  = function (...args) { record('warn',  format(args), 'console'); return orig.warn.apply(console,  args) }

  window.addEventListener('error', (e) => {
    const where   = e.filename ? `${e.filename}:${e.lineno || '?'}:${e.colno || '?'}` : ''
    const message = e.message || String(e.error?.message || '')
    record('error', `${message}${where ? ' (' + where + ')' : ''}`, 'window.error', e.error?.stack || null)
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason?.message || (typeof e.reason === 'string' ? e.reason : null) || String(e.reason)
    record('error', reason, 'unhandledrejection', e.reason?.stack || null)
  })
})()
