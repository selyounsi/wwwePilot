/**
 * Decides whether a module should run for a given URL based on its
 * urlPatterns config.
 *
 * Patterns are regex strings matched against the URL's pathname.
 *
 *   urlPatterns: {
 *     include: ['^/$', '^/blog/'],   // run only when one matches
 *     exclude: ['^/admin/']          // never run when one matches
 *   }
 *
 * exclude wins over include. Missing/empty config means "always run".
 */
export function moduleAppliesTo(mod, url) {
  const patterns = mod?.urlPatterns
  if (!patterns) return true

  let path = '/'
  try { path = new URL(url).pathname } catch {}

  const exclude = patterns.exclude ?? []
  if (exclude.some(p => safeMatch(p, path))) return false

  const include = patterns.include ?? []
  if (include.length === 0) return true
  return include.some(p => safeMatch(p, path))
}

function safeMatch(pattern, value) {
  try { return new RegExp(pattern).test(value) } catch { return false }
}
