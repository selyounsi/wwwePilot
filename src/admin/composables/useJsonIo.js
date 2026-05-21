/**
 * Tiny helpers for admin import / export flows. Trigger a JSON download
 * without server help, and let the user pick a JSON file to read back as
 * a parsed object. No state — pure utilities.
 */

export function downloadJson(data, filename) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on next tick — synchronous revoke can race with the click handler
  // when the user's default downloads folder is slow to write.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Prompts the user to pick a JSON file and resolves to the parsed object.
 * Resolves to `null` if the user cancels.
 */
export function pickJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        resolve(data)
      } catch (e) {
        reject(new Error(`Could not parse JSON: ${e.message}`))
      }
    }
    // Cancel detection: the dialog returns no `change` event when dismissed.
    // We don't reject on cancel; the caller awaits `null` instead.
    input.click()
  })
}

/**
 * Build a filename like `quick-info-2026-05-21.json`. ISO date keeps files
 * sortable in the downloads folder.
 */
export function timestampedFilename(stem) {
  const d = new Date().toISOString().slice(0, 10)
  return `${stem}-${d}.json`
}
