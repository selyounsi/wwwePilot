import { ref, computed } from 'vue'

export function useModuleFilter(result, defaultFilter = 'issues') {

  const filter = ref(defaultFilter)

  const hasIssues = computed(() =>
    ((result?.value?.errorCount ?? 0) + (result?.value?.warningCount ?? 0)) > 0
  )

  const filteredResult = computed(() => {
    const r = result?.value ?? { status: 'idle', errors: [], warnings: [], items: [], errorCount: 0, warningCount: 0 }

    if (!hasIssues.value) return r

    if (filter.value === 'errors')   return { ...r, items: (r.items ?? []).filter(i => i.type === 'error') }
    if (filter.value === 'warnings') return { ...r, items: (r.items ?? []).filter(i => i.type === 'warning') }
    if (filter.value === 'issues')   return { ...r, items: (r.items ?? []).filter(i => i.type === 'error' || i.type === 'warning') }

    // 'all' — Errors zuerst, dann Warnings, dann Success. Stable sort behält
    // Original-Reihenfolge innerhalb gleicher Severity.
    if (filter.value === 'all') {
      const sev = { error: 0, warning: 1, success: 2 }
      return { ...r, items: [...(r.items ?? [])].sort((a, b) => (sev[a.type] ?? 3) - (sev[b.type] ?? 3)) }
    }

    return r
  })

  return { filter, hasIssues, filteredResult }
}