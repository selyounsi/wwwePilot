<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useAdminReports } from '@/admin/modules/reports/composables/useAdminReports.js'
import { useTableExport }  from '@/admin/composables/useTableExport.js'

const router = useRouter()
const { t } = useI18n()
const { state, fetchAll, fetchStats } = useAdminReports()

const filterStatus   = ref('open')
const filterCategory = ref('')
const filterScope    = ref('')
const statsOpen      = ref(false)

onMounted(() => fetchAll({ status: filterStatus.value, limit: 100 }))

function applyFilter() {
  const f = { limit: 100 }
  if (filterStatus.value)   f.status   = filterStatus.value
  if (filterCategory.value) f.category = filterCategory.value
  if (filterScope.value)    f.scope    = filterScope.value
  fetchAll(f)
}

async function toggleStats() {
  statsOpen.value = !statsOpen.value
  if (statsOpen.value && !state.stats) await fetchStats()
}

const { exportCSV } = useTableExport()
function downloadCSV() {
  exportCSV({
    rows:     state.reports,
    filename: `reports-${new Date().toISOString().slice(0, 10)}.csv`,
    columns:  [
      { key: 'id',          label: 'ID' },
      { key: 'title',       label: 'Title' },
      { key: 'status',      label: 'Status' },
      { key: 'severity',    label: 'Severity' },
      { key: 'category',    label: 'Category' },
      { key: 'scope',       label: 'Scope' },
      { key: 'module_id',   label: 'Module' },
      { key: 'reporter',    label: 'Reporter', get: (r) => r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : (r.email ?? '') },
      { key: 'assignee',    label: 'Assigned to', get: (r) => r.assignee_first_name && r.assignee_last_name ? `${r.assignee_first_name} ${r.assignee_last_name}` : (r.assignee_email ?? '') },
      { key: 'created_at',  label: 'Created' },
      { key: 'updated_at',  label: 'Updated' },
      { key: 'comment_count', label: 'Comments' },
    ],
  })
}

function openReport(id) {
  router.push({ name: 'admin-report-detail', params: { id } })
}

function formatTime(ts) { return new Date(ts).toLocaleString() }

function userLabel(r) {
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  return r.email || (r.user_id ? r.user_id.slice(0, 8) : '—')
}

function assigneeLabel(r) {
  if (!r.assigned_to) return null
  if (r.assignee_first_name && r.assignee_last_name) return `${r.assignee_first_name} ${r.assignee_last_name}`
  return r.assignee_email || r.assigned_to.slice(0, 8)
}

function statusColor(s) {
  switch (s) {
    case 'open':          return 'bg-alert/15 text-alert'
    case 'investigating': return 'bg-primary/15 text-primary'
    case 'resolved':      return 'bg-success/15 text-success'
    case 'wont_fix':      return 'bg-surface text-muted'
    default:              return 'bg-surface text-light'
  }
}

function severityColor(s) {
  switch (s) {
    case 'high':   return 'bg-error/15 text-error'
    case 'medium': return 'bg-alert/15 text-alert'
    case 'low':    return 'bg-surface text-muted'
    default:       return 'bg-surface text-muted'
  }
}

function categoryLabel(c) {
  switch (c) {
    case 'bug':             return t('Bug')
    case 'false_positive':  return t('False positive')
    case 'feature_request': return t('Feature request')
    default:                return t('Other')
  }
}

function categoryColor(c) {
  switch (c) {
    case 'bug':             return 'bg-error/15   text-error'
    case 'false_positive':  return 'bg-alert/15   text-alert'
    case 'feature_request': return 'bg-primary/15 text-primary'
    default:                return 'bg-surface    text-muted'
  }
}

function categoryIcon(c) {
  switch (c) {
    case 'bug':             return 'mdiBugOutline'
    case 'false_positive':  return 'mdiFlagOutline'
    case 'feature_request': return 'mdiLightbulbOnOutline'
    default:                return 'mdiCommentQuestionOutline'
  }
}

function scopeLabel(s) {
  switch (s) {
    case 'app':         return t('App-wide')
    case 'module':      return t('Module')
    case 'module_item': return t('Finding')
    default:            return s
  }
}

function scopeColor(s) {
  switch (s) {
    case 'app':         return 'bg-primary/15 text-primary'
    case 'module':      return 'bg-alert/15   text-alert'
    case 'module_item': return 'bg-error/15   text-error'
    default:            return 'bg-surface    text-muted'
  }
}

function scopeIcon(s) {
  switch (s) {
    case 'app':         return 'mdiApplicationCogOutline'
    case 'module':      return 'mdiPuzzleOutline'
    case 'module_item': return 'mdiAlertCircleOutline'
    default:            return 'mdiCircleOutline'
  }
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const h = seconds / 3600
  if (h < 24) return t('{n} h', { n: h.toFixed(1) })
  return t('{n} d', { n: (h / 24).toFixed(1) })
}

function reporterDisplay(u) {
  if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`
  return u.email || u.id.slice(0, 8)
}

const inflowMax = computed(() => {
  const rows = state.stats?.inflow ?? []
  return Math.max(1, ...rows.map(r => r.n))
})
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold">{{ t('Reports') }}</h2>
        <p class="text-xs text-muted mt-0.5">{{ t('User-submitted bug reports, feature requests and false-positive flags.') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton
          variant="pill"
          :icon="statsOpen ? 'mdiChevronUp' : 'mdiChartBoxOutline'"
          :icon-size="13"
          @click="toggleStats"
        >{{ statsOpen ? t('Hide stats') : t('Show stats') }}</BaseButton>
        <BaseButton
          variant="pill"
          icon="mdiDownload"
          :icon-size="13"
          :tooltip="t('Export as CSV')"
          @click="downloadCSV"
        >CSV</BaseButton>
      </div>
    </header>

    <section v-if="statsOpen && state.stats" class="bg-surface-soft border border-border rounded-xl p-4 mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Reports by category') }}</div>
        <ul class="space-y-1 text-xs">
          <li v-for="(n, k) in state.stats.byCategory" :key="k" class="flex items-center justify-between">
            <span class="text-muted">{{ categoryLabel(k) }}</span>
            <span class="font-semibold tabular-nums">{{ n }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Reports by scope') }}</div>
        <ul class="space-y-1 text-xs">
          <li v-for="(n, k) in state.stats.byScope" :key="k" class="flex items-center justify-between">
            <span class="text-muted">{{ scopeLabel(k) }}</span>
            <span class="font-semibold tabular-nums">{{ n }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Top reporters') }}</div>
        <ul class="space-y-1 text-xs">
          <li v-for="u in state.stats.topReporters" :key="u.id" class="flex items-center justify-between gap-2">
            <span class="text-muted truncate">{{ reporterDisplay(u) }}</span>
            <span class="font-semibold tabular-nums">{{ u.n }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Avg resolution time') }}</div>
        <div class="text-xl font-bold tabular-nums">{{ formatDuration(state.stats.resolution?.avgSeconds) }}</div>
        <div class="text-[10px] text-muted/60 mt-1">{{ t('Median resolution time') }}: {{ formatDuration(state.stats.resolution?.medianSeconds) }}</div>
        <div v-if="!state.stats.resolution?.sampleSize" class="text-[10px] text-muted/60 italic mt-1">{{ t('no resolved reports yet') }}</div>
      </div>

      <div class="col-span-2 lg:col-span-4">
        <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Inflow (last 14 days)') }}</div>
        <div v-if="state.stats.inflow?.length" class="flex items-end gap-1 h-16">
          <div
            v-for="d in state.stats.inflow" :key="d.day"
            class="flex-1 bg-primary/40 rounded-t"
            :style="{ height: `${(d.n / inflowMax) * 100}%`, minHeight: '2px' }"
            :title="`${d.day}: ${d.n}`"
          ></div>
        </div>
        <p v-else class="text-xs text-muted/60 italic">{{ t('no data') }}</p>
      </div>
    </section>

    <section class="grid grid-cols-4 gap-3 mb-6">
      <button
        v-for="(count, status) in state.counts" :key="status"
        @click="filterStatus = status; applyFilter()"
        class="bg-surface-soft border rounded-xl p-4 text-left transition-colors hover:bg-surface-soft-hover"
        :class="filterStatus === status ? 'border-primary/60' : 'border-border'"
      >
        <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t(status) }}</div>
        <div class="text-2xl font-bold tabular-nums mt-1">{{ count }}</div>
      </button>
    </section>

    <section class="bg-surface-soft border border-border rounded-xl">
      <div class="px-4 py-3 border-b border-border/60 flex flex-wrap gap-2 items-center">
        <select v-model="filterStatus" class="bg-surface border border-border rounded px-2 py-1.5 text-xs">
          <option value="">{{ t('All statuses') }}</option>
          <option value="open">{{ t('Open') }}</option>
          <option value="investigating">{{ t('Investigating') }}</option>
          <option value="resolved">{{ t('Resolved') }}</option>
          <option value="wont_fix">{{ t("Won't fix") }}</option>
        </select>
        <select v-model="filterCategory" class="bg-surface border border-border rounded px-2 py-1.5 text-xs">
          <option value="">{{ t('All categories') }}</option>
          <option value="bug">{{ t('Bug') }}</option>
          <option value="false_positive">{{ t('False positive') }}</option>
          <option value="feature_request">{{ t('Feature request') }}</option>
          <option value="other">{{ t('Other') }}</option>
        </select>
        <select v-model="filterScope" class="bg-surface border border-border rounded px-2 py-1.5 text-xs">
          <option value="">{{ t('All scopes') }}</option>
          <option value="app">{{ t('App-wide') }}</option>
          <option value="module">{{ t('Module-scoped') }}</option>
          <option value="module_item">{{ t('Item-scoped') }}</option>
        </select>
        <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="applyFilter">{{ t('Apply') }}</BaseButton>
      </div>

      <div v-if="state.loading" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <div v-else-if="state.error" class="p-4 text-error text-sm">{{ state.error }}</div>

      <table v-else-if="state.reports.length" class="w-full text-sm">
        <thead class="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="text-left px-4 py-2 font-medium">{{ t('Type') }}</th>
            <th class="text-left px-4 py-2 font-medium">{{ t('Title') }}</th>
            <th class="text-left px-4 py-2 font-medium">{{ t('User') }}</th>
            <th class="text-left px-4 py-2 font-medium">{{ t('Assigned to') }}</th>
            <th class="text-left px-4 py-2 font-medium">{{ t('When') }}</th>
            <th class="text-left px-4 py-2 font-medium">{{ t('Severity') }}</th>
            <th class="text-left px-4 py-2 font-medium">{{ t('Status') }}</th>
            <th class="text-right px-4 py-2 font-medium">{{ t('Comments') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in state.reports" :key="r.id"
            @click="openReport(r.id)"
            class="border-t border-border/40 hover:bg-surface-soft-hover cursor-pointer"
          >
            <td class="px-4 py-2 whitespace-nowrap">
              <div class="inline-flex flex-col gap-1">
                <span class="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 w-fit" :class="scopeColor(r.scope)">
                  <Icon :name="scopeIcon(r.scope)" :size="11" />
                  {{ scopeLabel(r.scope) }}
                  <code v-if="r.module_id" class="ml-1 font-mono opacity-70">{{ r.module_id }}</code>
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 w-fit" :class="categoryColor(r.category)">
                  <Icon :name="categoryIcon(r.category)" :size="11" />
                  {{ categoryLabel(r.category) }}
                </span>
              </div>
            </td>
            <td class="px-4 py-2 text-[11px] max-w-80 truncate" :title="r.title">{{ r.title }}</td>
            <td class="px-4 py-2 text-[11px]">{{ userLabel(r) }}</td>
            <td class="px-4 py-2 text-[11px]">
              <span v-if="assigneeLabel(r)">{{ assigneeLabel(r) }}</span>
              <span v-else class="text-muted/60 italic">{{ t('Unassigned') }}</span>
            </td>
            <td class="px-4 py-2 text-[11px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(r.created_at) }}</td>
            <td class="px-4 py-2">
              <span class="text-[10px] px-1.5 py-0.5 rounded" :class="severityColor(r.severity)">{{ t(r.severity) }}</span>
            </td>
            <td class="px-4 py-2">
              <span class="text-[10px] px-1.5 py-0.5 rounded" :class="statusColor(r.status)">{{ t(r.status) }}</span>
            </td>
            <td class="px-4 py-2 text-[11px] text-right tabular-nums">{{ r.comment_count }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="px-4 py-8 text-center text-sm text-muted">{{ t('No reports yet.') }}</p>
    </section>
  </div>
</template>
