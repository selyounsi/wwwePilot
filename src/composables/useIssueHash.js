/**
 * Stable identifier for a specific finding. The hash mixes module + element
 * + issue type + issue message so the same element flagged with two
 * different problems gets two different hashes — admins can then track
 * each finding independently.
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

/** Hash for one specific issue (error / warning) on one item. */
export async function computeIssueHash(moduleId, item, issue) {
  const type    = issue?.type    ?? 'info'
  const message = issue?.message ?? ''
  const key     = `${moduleId}|${type}|${elementKey(item)}|${message}`
  return sha256Hex(key)
}
