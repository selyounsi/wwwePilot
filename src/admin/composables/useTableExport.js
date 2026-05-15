/**
 * Generic CSV/JSON exporter for admin tables. Triggers a browser download
 * with a sensible default filename like `reports-2026-05-15.csv`.
 *
 * Columns:
 *   [{ key: 'email', label: 'Email', get?: (row) => string }]
 * Each row's value is `get(row)` if provided, otherwise `row[key]`. The
 * `get` escape lets you flatten nested fields or pre-format dates.
 */

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  // Quote if the value contains a comma, quote, newline, or leading/trailing
  // whitespace — RFC 4180-ish.
  return /[",\n\r]/.test(s) || s !== s.trim()
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function toCSV(rows, columns) {
  const header = columns.map(c => csvEscape(c.label ?? c.key)).join(',')
  const body   = rows.map(row =>
    columns.map(c => csvEscape(c.get ? c.get(row) : row[c.key])).join(','),
  )
  // Excel needs a BOM to detect UTF-8 in CSV files. Without it, German umlauts
  // come out as mojibake when the user opens the file by double-clicking.
  return '﻿' + [header, ...body].join('\r\n')
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function todayStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function useTableExport() {
  /**
   * Triggers a CSV download of `rows`. Columns can be plain strings (treated
   * as `{ key, label: key }`) or objects with `{ key, label?, get? }`.
   */
  function exportCSV({ rows, columns, filename }) {
    const cols = columns.map(c => typeof c === 'string' ? { key: c, label: c } : c)
    const name = filename ?? `export-${todayStamp()}.csv`
    download(name, toCSV(rows, cols), 'text/csv;charset=utf-8')
  }

  function exportJSON({ rows, filename }) {
    const name = filename ?? `export-${todayStamp()}.json`
    download(name, JSON.stringify(rows, null, 2), 'application/json')
  }

  return { exportCSV, exportJSON }
}
