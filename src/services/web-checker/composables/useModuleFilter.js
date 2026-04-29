import { ref, computed } from 'vue'

const SEVERITY = { error: 0, warning: 1, success: 2 }
const sortBySeverity = (items) =>
  [...items].sort((a, b) => (SEVERITY[a.type] ?? 3) - (SEVERITY[b.type] ?? 3))

export function useModuleFilter(result, defaultFilter = 'issues') {

  const filter = ref(defaultFilter)

  const hasIssues = computed(() =>
    ((result?.value?.errorCount ?? 0) + (result?.value?.warningCount ?? 0)) > 0
  )

  const filteredResult = computed(() => {
    const r = result?.value ?? { status: 'idle', errors: [], warnings: [], items: [], errorCount: 0, warningCount: 0 }

    if (!hasIssues.value) return r

    let items = r.items ?? []
    if      (filter.value === 'errors')   items = items.filter(i => i.type === 'error')
    else if (filter.value === 'warnings') items = items.filter(i => i.type === 'warning')
    else if (filter.value === 'issues')   items = items.filter(i => i.type === 'error' || i.type === 'warning')

    // Always sort by severity — errors first, then warnings, then success.
    // Stable sort keeps original order within each severity group.
    return { ...r, items: sortBySeverity(items) }
  })

  return { filter, hasIssues, filteredResult }
}
