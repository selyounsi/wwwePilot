import { ref, computed } from 'vue'

export function useModuleFilter(result) {

  const filter = ref('issues')

  const hasIssues = computed(() =>
    ((result?.value?.errorCount ?? 0) + (result?.value?.warningCount ?? 0)) > 0
  )

  const filteredResult = computed(() => {
    const r = result?.value ?? { status: 'idle', errors: [], warnings: [], items: [], errorCount: 0, warningCount: 0 }

    if (!hasIssues.value) return r

    if (filter.value === 'errors')   return { ...r, items: (r.items ?? []).filter(i => i.type === 'error') }
    if (filter.value === 'warnings') return { ...r, items: (r.items ?? []).filter(i => i.type === 'warning') }
    if (filter.value === 'issues')   return { ...r, items: (r.items ?? []).filter(i => i.type === 'error' || i.type === 'warning') }

    return r
  })

  return { filter, hasIssues, filteredResult }
}