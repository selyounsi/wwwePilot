<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }       from '@/composables/i18n/useI18n.js'
import { useToast }      from '@/composables/useToast.js'
import { useAdminReports } from '@/admin/modules/reports/composables/useAdminReports.js'
import { useAdminUsers }   from '@/admin/modules/users/composables/useAdminUsers.js'
import { usePermissions }  from '@/composables/usePermissions.js'
import { useAuth }         from '@/composables/auth/useAuth.js'

const router = useRouter()
const route  = useRoute()
const { t } = useI18n()
const toast = useToast()
const { fetchDetail, update, assign, remove, comment } = useAdminReports()
const { state: usersState, fetchAll: fetchUsers } = useAdminUsers()
const { has, canWriteUsers } = usePermissions()
const { state: authState } = useAuth()

const id = computed(() => String(route.params.id ?? ''))

const data    = ref(null)
const loading = ref(false)
const error   = ref(null)
const newComment = ref('')
const editingResolution = ref(false)
const resolutionDraft   = ref('')

const canWriteReports = computed(() => has('admin.reports.write'))

// Custom-confirm modal state. We don't use browser confirm() for status
// changes because the user explicitly asked for a styled dialog.
const confirmOpen   = ref(false)
const confirmStatus = ref(null)
const deleteOpen    = ref(false)

const STATUSES = ['open', 'investigating', 'resolved', 'wont_fix']
const statusLabels = computed(() => ({
  open:          t('Open'),
  investigating: t('Investigating'),
  resolved:      t('Resolved'),
  wont_fix:      t("Won't fix"),
}))

async function load() {
  loading.value = true
  error.value   = null
  try {
    data.value = await fetchDetail(id.value)
    resolutionDraft.value = data.value?.report?.resolution ?? ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  if (canWriteReports.value) fetchUsers()
})
watch(id, load)

function formatTime(ts) { return ts ? new Date(ts).toLocaleString() : '—' }

function authorLabel(c) {
  if (c.first_name && c.last_name) return `${c.first_name} ${c.last_name}`
  return c.email || (c.user_id ? c.user_id.slice(0, 8) : '—')
}

function reporterLabel() {
  const r = data.value?.report
  if (!r) return '—'
  if (r.author_first_name && r.author_last_name) return `${r.author_first_name} ${r.author_last_name}`
  return r.author_email || (r.user_id ? r.user_id.slice(0, 8) : '—')
}

function assigneeLabel() {
  const r = data.value?.report
  if (!r?.assigned_to) return t('Unassigned')
  if (r.assignee_first_name && r.assignee_last_name) return `${r.assignee_first_name} ${r.assignee_last_name}`
  return r.assignee_email || r.assigned_to.slice(0, 8)
}

function userOptionLabel(u) {
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email
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

function onStatusSelect(e) {
  const next = e.target.value
  if (!next || next === data.value?.report?.status) return
  confirmStatus.value = next
  confirmOpen.value   = true
}

async function confirmStatusChange() {
  try {
    await update(id.value, { status: confirmStatus.value })
    await load()
    toast.success(t('Status updated'))
  } catch (e) { toast.error(e.message) }
  finally {
    confirmStatus.value = null
  }
}

function cancelStatusChange() {
  // Reset the select to current status — the v-model isn't bound so we have
  // to do this manually by reloading the data which re-renders the option.
  confirmStatus.value = null
}

async function setSeverity(severity) {
  try {
    await update(id.value, { severity })
    await load()
  } catch (e) { toast.error(e.message) }
}

async function onAssignChange(e) {
  const userId = e.target.value || null
  try {
    await assign(id.value, userId)
    await load()
    toast.success(t('Assignment updated'))
  } catch (e) { toast.error(e.message) }
}

async function takeThis() {
  try {
    await assign(id.value, authState.user?.id)
    await load()
    toast.success(t('Assignment updated'))
  } catch (e) { toast.error(e.message) }
}

async function saveResolution() {
  try {
    await update(id.value, { resolution: resolutionDraft.value })
    await load()
    editingResolution.value = false
    toast.success(t('Resolution saved'))
  } catch (e) { toast.error(e.message) }
}

async function postComment() {
  if (!newComment.value.trim()) return
  try {
    await comment(id.value, newComment.value.trim())
    newComment.value = ''
    await load()
  } catch (e) { toast.error(e.message) }
}

async function onDeleteConfirm() {
  try {
    await remove(id.value)
    toast.success(t('Report deleted'))
    router.replace({ name: 'admin-reports' })
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center gap-3">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.back()">{{ t('Back') }}</BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate">{{ data?.report?.title ?? '—' }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ id }}</p>
      </div>
      <BaseButton
        v-if="canWriteUsers"
        variant="pill"
        icon="mdiDelete"
        :icon-size="13"
        class="text-error! border-error/30! hover:bg-error/10!"
        @click="deleteOpen = true"
      >{{ t('Delete') }}</BaseButton>
    </header>

    <div v-if="loading && !data" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="bg-error/10 border border-error/40 rounded-xl p-4 text-sm text-error">{{ error }}</div>

    <div v-else-if="data?.report" class="grid grid-cols-3 gap-6">
      <div class="col-span-2 space-y-6">
        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <header class="flex items-center gap-2 mb-3 text-[11px] text-muted">
            <strong class="text-light">{{ reporterLabel() }}</strong>
            <span>·</span>
            <span>{{ formatTime(data.report.created_at) }}</span>
            <span v-if="data.report.origin" class="ml-auto font-mono truncate max-w-60" :title="data.report.origin">{{ data.report.origin }}{{ data.report.scope_path }}</span>
          </header>
          <p class="text-sm whitespace-pre-wrap">{{ data.report.description }}</p>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl">
          <header class="px-4 py-3 border-b border-border/60">
            <h3 class="font-semibold text-sm">{{ t('Comments') }} ({{ (data.comments ?? []).length }})</h3>
          </header>
          <div v-if="(data.comments ?? []).length" class="divide-y divide-border/30">
            <div v-for="c in data.comments" :key="c.id" class="px-4 py-3">
              <div class="flex items-center gap-2 text-[11px] text-muted mb-1">
                <strong class="text-light">{{ authorLabel(c) }}</strong>
                <span>·</span>
                <span>{{ formatTime(c.created_at) }}</span>
              </div>
              <p class="text-sm whitespace-pre-wrap">{{ c.content }}</p>
            </div>
          </div>
          <p v-else class="px-4 py-6 text-center text-sm text-muted">{{ t('No comments yet.') }}</p>

          <div v-if="canWriteReports" class="px-4 py-3 border-t border-border/60">
            <textarea
              v-model="newComment"
              rows="2"
              :placeholder="t('Add a comment…')"
              class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:border-primary/60"
            />
            <div class="mt-2 flex justify-end">
              <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" :disabled="!newComment.trim()" @click="postComment">
                {{ t('Post comment') }}
              </BaseButton>
            </div>
          </div>
        </section>
      </div>

      <div class="space-y-3">
        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-2">{{ t('Status') }}</div>
          <span class="text-xs px-2 py-1 rounded font-semibold" :class="statusColor(data.report.status)">{{ t(data.report.status) }}</span>
          <div v-if="canWriteReports" class="mt-3">
            <select
              :value="data.report.status"
              class="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary/60"
              @change="onStatusSelect"
            >
              <option v-for="s in STATUSES" :key="s" :value="s">{{ statusLabels[s] }}</option>
            </select>
          </div>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Assigned to') }}</div>
            <button
              v-if="canWriteReports && authState.user && data.report.assigned_to !== authState.user.id"
              class="text-[10px] text-primary hover:underline"
              @click="takeThis"
            >{{ t('Take this') }}</button>
          </div>
          <div class="text-xs mb-2">{{ assigneeLabel() }}</div>
          <select
            v-if="canWriteReports"
            :value="data.report.assigned_to ?? ''"
            class="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary/60"
            @change="onAssignChange"
          >
            <option value="">{{ t('Unassigned') }}</option>
            <option v-for="u in usersState.users" :key="u.id" :value="u.id">{{ userOptionLabel(u) }}</option>
          </select>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-1">{{ t('Severity') }}</div>
          <div class="inline-flex gap-1">
            <button
              v-for="s in ['low', 'medium', 'high']" :key="s"
              :disabled="!canWriteReports"
              @click="setSeverity(s)"
              class="text-[11px] px-3 py-1 rounded-full border transition-colors disabled:opacity-60 disabled:cursor-default"
              :class="data.report.severity === s
                ? 'bg-primary text-black/80 border-primary'
                : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
            >{{ t(s) }}</button>
          </div>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl p-4 space-y-2 text-xs">
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Category') }}</div>
            <div class="mt-0.5">{{ t(data.report.category) }}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Scope') }}</div>
            <code class="text-[11px]">{{ data.report.scope }}</code>
            <code v-if="data.report.module_id" class="ml-1 text-[11px] text-muted">{{ data.report.module_id }}</code>
          </div>
          <div v-if="data.report.issue_hash">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Issue hash') }}</div>
            <code class="text-[10px] text-muted">{{ data.report.issue_hash.slice(0, 16) }}</code>
          </div>
          <div v-if="data.report.extension_version">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Extension version') }}</div>
            <div class="mt-0.5 font-mono text-[11px]">v{{ data.report.extension_version }}</div>
          </div>
          <div v-if="data.report.user_agent">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('User agent') }}</div>
            <p class="text-[10px] text-muted break-all">{{ data.report.user_agent }}</p>
          </div>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <header class="flex items-center justify-between mb-2">
            <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Resolution note') }}</div>
            <BaseButton
              v-if="canWriteReports"
              variant="pill"
              :icon="editingResolution ? 'mdiClose' : 'mdiPencil'"
              :icon-size="11"
              @click="editingResolution ? (editingResolution = false, resolutionDraft = data.report.resolution ?? '') : (editingResolution = true)"
            >{{ editingResolution ? t('Cancel') : t('Edit') }}</BaseButton>
          </header>
          <template v-if="editingResolution">
            <textarea
              v-model="resolutionDraft"
              rows="3"
              :placeholder="t('What was the resolution? Visible to the reporter.')"
              class="w-full bg-surface border border-border rounded px-2 py-1 text-sm resize-y focus:outline-none focus:border-primary/60"
            />
            <div class="mt-2 flex justify-end">
              <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="saveResolution">{{ t('Save') }}</BaseButton>
            </div>
          </template>
          <p v-else-if="data.report.resolution" class="text-xs whitespace-pre-wrap">{{ data.report.resolution }}</p>
          <p v-else class="text-xs text-muted/60 italic">{{ t('No resolution yet.') }}</p>
        </section>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      :title="t('Confirm status change?')"
      :message="t('Change report status to “{status}”?', { status: statusLabels[confirmStatus] ?? confirmStatus })"
      :confirm-text="t('Set status')"
      variant="primary"
      @update:open="confirmOpen = $event"
      @confirm="confirmStatusChange"
      @cancel="cancelStatusChange"
    />

    <ConfirmDialog
      :open="deleteOpen"
      :title="t('Delete this report permanently?')"
      :confirm-text="t('Delete')"
      variant="danger"
      @update:open="deleteOpen = $event"
      @confirm="onDeleteConfirm"
    />
  </div>
</template>
