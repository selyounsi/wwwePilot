/**
 * Numeric semver-ish compare (major.minor.patch). Returns negative if a < b,
 * zero if equal, positive if a > b. Missing segments are treated as 0.
 */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0, db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}
