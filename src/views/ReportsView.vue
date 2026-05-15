<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n }    from '@/composables/i18n/useI18n.js'
import { useToast }   from '@/composables/useToast.js'
import { useReports } from '@/composables/useReports.js'
import { apiJson }    from '@/composables/auth/apiClient.js'
import { API }        from '@/config/api.js'
import { APP_NAME }   from '@/config/app.js'

const { t } = useI18n()
const toast = useToast()
const { state, fetchMine, openDialog: openReportDialog, comment } = useReports()

const expandedId = ref(null)
const commentDrafts = ref({})
const details = ref({})  // reportId → { comments, loading }

onMounted(fetchMine)

function categoryLabel(c) {
  switch (c) {
    case 'bug':             return t('Bug')
    case 'false_positive':  return t('False positive')
    case 'feature_request': return t('Feature request')
    default:                return t('Other')
  }
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

function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)    return t('just now')
  if (min < 60)   return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)     return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

async function toggle(report) {
  if (expandedId.value === report.id) {
    expandedId.value = null
    return
  }
  expandedId.value = report.id
  if (!details.value[report.id]) {
    details.value[report.id] = { loading: true, data: null }
    try {
      const data = await apiJson(`${API.reports.url}/${report.id}`)
      details.value[report.id] = { loading: false, data }
    } catch (e) {
      details.value[report.id] = { loading: false, data: null, error: e.message }
    }
  }
}

async function postComment(reportId) {
  const content = commentDrafts.value[reportId]?.trim()
  if (!content) return
  try {
    await comment(reportId, content)
    commentDrafts.value[reportId] = ''
    // refresh detail
    const data = await apiJson(`${API.reports.url}/${reportId}`)
    details.value[reportId] = { loading: false, data }
    toast.success(t('Comment posted'))
  } catch (e) { toast.error(e.message) }
}

function authorLabel(c) {
  if (c.first_name && c.last_name) return `${c.first_name} ${c.last_name}`
  return c.email || (c.user_id ? c.user_id.slice(0, 8) : '—')
}

const openCount = computed(() => state.mine.filter(r => r.status === 'open' || r.status === 'investigating').length)
const resolvedCount = computed(() => state.mine.filter(r => r.status === 'resolved' || r.status === 'wont_fix').length)
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader showBack :title="t('My reports')" :subtitle="t('Bugs, feedback and feature requests you sent')">
      <BaseButton
        variant="header-icon"
        icon="mdiPlus"
        :icon-size="16"
        :tooltip="t('New report')"
        @click="openReportDialog({ scope: 'app' })"
      />
    </AppHeader>

    <div class="flex-1 px-4 py-4 flex flex-col gap-3">
      <section v-if="state.mine.length" class="grid grid-cols-2 gap-2">
        <div class="bg-surface-soft border border-border rounded-xl p-3">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Open / investigating') }}</div>
          <div class="text-xl font-bold tabular-nums mt-0.5">{{ openCount }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-3">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Resolved') }}</div>
          <div class="text-xl font-bold tabular-nums mt-0.5">{{ resolvedCount }}</div>
        </div>
      </section>

      <BaseButton
        v-if="!state.mine.length"
        @click="openReportDialog({ scope: 'app' })"
      >
        <Icon name="mdiBugOutline" :size="14" />
        {{ t('Submit your first report') }}
      </BaseButton>

      <div v-if="state.loading && !state.mine.length" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <p v-else-if="!state.mine.length" class="text-center text-sm text-muted py-8">
        {{ t('No reports yet. Found a bug or want to suggest something? Send a report and admins will look at it.') }}
      </p>

      <div v-else class="flex flex-col gap-2">
        <div
          v-for="r in state.mine" :key="r.id"
          class="bg-surface-soft border border-border rounded-xl overflow-hidden"
        >
          <button
            @click="toggle(r)"
            class="w-full px-4 py-3 flex items-start gap-3 hover:bg-surface-soft-hover transition-colors text-left"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                <span class="font-semibold text-sm truncate">{{ r.title }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded shrink-0" :class="statusColor(r.status)">{{ t(r.status) }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted shrink-0">{{ categoryLabel(r.category) }}</span>
              </div>
              <div class="text-[11px] text-muted flex items-center gap-2">
                <span>{{ relative(r.created_at) }}</span>
                <code v-if="r.module_id" class="text-[10px]">{{ r.module_id }}</code>
                <span v-if="r.origin" class="truncate">{{ r.origin }}</span>
              </div>
            </div>
            <Icon :name="expandedId === r.id ? 'mdiChevronUp' : 'mdiChevronDown'" :size="16" class="text-muted shrink-0 mt-1" />
          </button>

          <div v-if="expandedId === r.id" class="border-t border-border/40 px-4 py-3 space-y-3">
            <p class="text-sm whitespace-pre-wrap text-light">{{ r.description }}</p>

            <div v-if="r.resolution" class="bg-surface border border-success/30 rounded-lg p-2.5">
              <div class="text-[10px] uppercase tracking-wide text-success/80 mb-1">{{ t('Admin resolution') }}</div>
              <p class="text-xs whitespace-pre-wrap">{{ r.resolution }}</p>
            </div>

            <!-- Comments thread -->
            <div v-if="details[r.id]?.loading" class="text-xs text-muted text-center py-2">
              {{ t('Loading…') }}
            </div>

            <div v-else-if="details[r.id]?.data" class="space-y-2">
              <div
                v-for="c in (details[r.id].data.comments ?? [])" :key="c.id"
                class="bg-surface border border-border/40 rounded-lg p-2"
              >
                <div class="text-[10px] text-muted mb-0.5">
                  <strong class="text-light">{{ authorLabel(c) }}</strong>
                  · {{ relative(c.created_at) }}
                </div>
                <p class="text-xs whitespace-pre-wrap">{{ c.content }}</p>
              </div>

              <div class="mt-2">
                <textarea
                  v-model="commentDrafts[r.id]"
                  rows="2"
                  :placeholder="t('Add a comment…')"
                  class="w-full bg-surface border border-border rounded px-2 py-1 text-xs resize-y focus:outline-none focus:border-primary/60"
                />
                <div class="flex justify-end mt-1">
                  <BaseButton
                    variant="pill"
                    class="bg-primary! border-primary! text-black/80!"
                    :disabled="!commentDrafts[r.id]?.trim()"
                    @click="postComment(r.id)"
                  >{{ t('Post comment') }}</BaseButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
