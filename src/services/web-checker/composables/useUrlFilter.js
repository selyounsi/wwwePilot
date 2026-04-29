// Exact pathname match against runOnPaths/skipOnPaths in the given context
// (singlePage | fullSite). skipOnPaths wins. Empty/missing config = always run.
export function moduleAppliesTo(mod, url, context = 'singlePage') {
  const cfg    = mod?.[context] ?? {}
  const runOn  = cfg.runOnPaths  ?? []
  const skipOn = cfg.skipOnPaths ?? []
  if (runOn.length === 0 && skipOn.length === 0) return true

  let path = '/'
  try { path = new URL(url).pathname } catch {}

  const norm = (p) => (p === '/' ? '/' : p.replace(/\/$/, ''))
  const cur  = norm(path)

  if (skipOn.some(p => norm(p) === cur)) return false
  if (runOn.length === 0) return true
  return runOn.some(p => norm(p) === cur)
}
