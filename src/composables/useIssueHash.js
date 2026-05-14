/**
 * Stable identifier for an "issue location" within a module run. The hash is
 * scoped to (module, element-identifier, severity-bucket) — multiple issues
 * on the same element of the same severity collapse into one note target.
 *
 * Recipe deliberately ignores i18n'd messages so notes survive translation
 * changes. It does use the element's `_meta` (tag+idx or selector) and falls
 * back to href/src for items that don't carry meta.
 */
async function sha256Hex(str) {
  const buf  = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function elementKey(item) {
  if (item?.href)             return `h:${item.href}`
  if (item?.src)              return `s:${item.src}`
  if (item?.url)              return `u:${item.url}`
  if (item?._meta?.selector)  return `sel:${item._meta.selector}`
  if (item?._meta?.tag)       return `tag:${item._meta.tag}:${item._meta.idx ?? 0}`
  return 'unknown'
}

function topSeverity(item) {
  const types = (item?.issues ?? []).map(i => i.type)
  if (types.includes('error'))   return 'error'
  if (types.includes('warning')) return 'warning'
  return 'info'
}

export async function computeIssueHash(moduleId, item) {
  const key = `${moduleId}|${topSeverity(item)}|${elementKey(item)}`
  return sha256Hex(key)
}
