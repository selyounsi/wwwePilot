import { ref, computed } from 'vue'
import { useIgnoreList } from './useIgnoreList.js'
import { useCheckStore } from './useCheckStore.js'

const SEVERITY = { error: 0, warning: 1, success: 2 }
const sortBySeverity = (items) =>
  [...items].sort((a, b) => (SEVERITY[a.type] ?? 3) - (SEVERITY[b.type] ?? 3))

export function useModuleFilter(result, defaultFilter = 'issues', moduleId = null) {

  const filter = ref(defaultFilter)
  const { isIgnored } = useIgnoreList()
  const { state: checkState } = useCheckStore()

  const hasIssues = computed(() =>
    ((result?.value?.errorCount ?? 0) + (result?.value?.warningCount ?? 0)) > 0
  )

  const origin = computed(() => {
    try { return new URL(checkState.checkedUrl ?? '').origin } catch { return null }
  })

  const filteredResult = computed(() => {
    const r = result?.value ?? { status: 'idle', errors: [], warnings: [], items: [], errorCount: 0, warningCount: 0 }

    let items = r.items ?? []
    let ignoredCount = 0
    let recountedErrors   = 0
    let recountedWarnings = 0

    if (origin.value && moduleId) {
      items = items.filter(item => {
        const nonSuccessIssues = (item.issues ?? []).filter(i => i.type !== 'success')
        if (nonSuccessIssues.length === 0) return true
        const allIgnored = nonSuccessIssues.every(i => isIgnored(origin.value, moduleId, i.message))
        if (allIgnored) { ignoredCount++; return false }
        return true
      })
    }

    items.forEach(item => {
      if (item.type === 'error')   recountedErrors++
      else if (item.type === 'warning') recountedWarnings++
    })

    const adjusted = ignoredCount > 0
      ? { ...r, items, errorCount: recountedErrors, warningCount: recountedWarnings, ignoredCount }
      : { ...r, items, ignoredCount: 0 }

    if (!hasIssues.value && ignoredCount === 0) return adjusted

    if      (filter.value === 'errors')   items = items.filter(i => i.type === 'error')
    else if (filter.value === 'warnings') items = items.filter(i => i.type === 'warning')
    else if (filter.value === 'issues')   items = items.filter(i => i.type === 'error' || i.type === 'warning')

    return { ...adjusted, items: sortBySeverity(items) }
  })

  return { filter, hasIssues, filteredResult }
}
