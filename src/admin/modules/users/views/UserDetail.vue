<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }        from '@/composables/i18n/useI18n.js'
import { useToast }       from '@/composables/useToast.js'
import { useAdminUsers } from '@/admin/modules/users/composables/useAdminUsers.js'
import { useAdminRoles } from '@/admin/modules/roles/composables/useAdminRoles.js'
import { usePermissions } from '@/composables/usePermissions.js'

const router = useRouter()
const route  = useRoute()
const { t }  = useI18n()
const toast  = useToast()
const { fetchDetails, updateUser, suspend, unsuspend, setRoles, remove } = useAdminUsers()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()
const { canWriteUsers } = usePermissions()

const id = computed(() => String(route.params.id ?? ''))

const data        = ref(null)
const loading     = ref(false)
const error       = ref(null)
const editingNote = ref(false)
const noteDraft   = ref('')
const editingRoles= ref(false)
const draftRoles  = ref([])

async function load() {
  if (!id.value) return
  loading.value = true
  error.value   = null
  try {
    data.value = await fetchDetails(id.value)
    noteDraft.value = data.value?.user?.adminNote ?? ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  fetchRoles()
})
watch(id, load)

function userLabel(u) {
  if (!u) return '—'
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email || u.id.slice(0, 8)
}

async function saveNote() {
  try {
    const result = await updateUser(id.value, { adminNote: noteDraft.value || null })
    if (data.value) data.value.user = { ...data.value.user, adminNote: result.user.adminNote }
    editingNote.value = false
    toast.success(t('Note saved'))
  } catch (e) { toast.error(e.message) }
}

function startEditRoles() {
  editingRoles.value = true
  draftRoles.value = [...(data.value?.user?.roles ?? [])]
}

function toggleRole(roleId) {
  const i = draftRoles.value.indexOf(roleId)
  if (i >= 0) draftRoles.value.splice(i, 1)
  else        draftRoles.value.push(roleId)
}

async function saveRoles() {
  try {
    await setRoles(id.value, draftRoles.value)
    if (data.value) data.value.user = { ...data.value.user, roles: [...draftRoles.value] }
    editingRoles.value = false
    toast.success(t('Roles updated'))
  } catch (e) { toast.error(e.message) }
}

async function onSuspend() {
  if (!confirm(t('Suspend {name}?', { name: userLabel(data.value?.user) }))) return
  try {
    await suspend(id.value)
    if (data.value) data.value.user = { ...data.value.user, suspendedAt: new Date().toISOString() }
    toast.success(t('User suspended'))
  } catch (e) { toast.error(e.message) }
}

async function onUnsuspend() {
  try {
    await unsuspend(id.value)
    if (data.value) data.value.user = { ...data.value.user, suspendedAt: null }
    toast.success(t('User reactivated'))
  } catch (e) { toast.error(e.message) }
}

async function onDelete() {
  const u = data.value?.user
  if (!u) return
  if (u.isSuperAdmin) {
    toast.error(t('Superadmin cannot be deleted.'))
    return
  }
  const typed = prompt(t('Deleting "{name}" is permanent. Type the user email "{email}" to confirm:', { name: userLabel(u), email: u.email }))
  if (typed !== u.email) {
    if (typed !== null) toast.error(t('Confirmation did not match — nothing deleted.'))
    return
  }
  try {
    await remove(id.value, u.email)
    toast.success(t('User deleted'))
    router.replace({ name: 'admin-users' })
  } catch (e) { toast.error(e.message) }
}

function openRun(r)  { router.push({ name: 'admin-run-detail',  params: { id: r.id } }) }
function openSite(s) { router.push({ name: 'admin-site-detail', params: { origin: encodeURIComponent(s.origin) } }) }

const sitesColumns = [
  { key: 'origin',   label: 'Origin',   minWidth: 200, truncate: true, titleFrom: s => s.origin },
  { key: 'runs',     label: 'Runs',     minWidth: 70,  align: 'right' },
  { key: 'errors',   label: 'Errors',   minWidth: 70,  align: 'right' },
  { key: 'lastRun',  label: 'Last run', minWidth: 110, align: 'right' },
]

const runsColumns = [
  { key: 'when',     label: 'When',     minWidth: 150 },
  { key: 'origin',   label: 'Origin',   minWidth: 200, truncate: true, titleFrom: r => r.origin },
  { key: 'kind',     label: 'Kind',     minWidth: 100 },
  { key: 'status',   label: 'Status',   minWidth: 110 },
  { key: 'errors',   label: 'Errors',   minWidth: 70, align: 'right' },
  { key: 'warnings', label: 'Warnings', minWidth: 80, align: 'right' },
]

const eventsColumns = [
  { key: 'when',   label: 'When',   minWidth: 150 },
  { key: 'type',   label: 'Type',   minWidth: 200 },
  { key: 'target', label: 'Target', minWidth: 200, truncate: true, titleFrom: e => e.target ?? '' },
]
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center gap-3 flex-wrap">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.back()">
        {{ t('Back') }}
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate">{{ userLabel(data?.user) }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ data?.user?.email }} · {{ id }}</p>
      </div>
      <div v-if="canWriteUsers && data?.user && !data.user.isSuperAdmin" class="inline-flex gap-1 flex-wrap">
        <BaseButton
          v-if="data.user.suspendedAt"
          variant="pill"
          icon="mdiAccountCheck"
          :icon-size="13"
          class="text-success! border-success/30! hover:bg-success/10!"
          @click="onUnsuspend"
        >{{ t('Reactivate') }}</BaseButton>
        <BaseButton
          v-else
          variant="pill"
          icon="mdiAccountCancel"
          :icon-size="13"
          class="text-alert! border-alert/30! hover:bg-alert/10!"
          @click="onSuspend"
        >{{ t('Suspend') }}</BaseButton>
        <BaseButton
          variant="pill"
          icon="mdiDelete"
          :icon-size="13"
          class="text-error! border-error/30! hover:bg-error/10!"
          @click="onDelete"
        >{{ t('Delete user') }}</BaseButton>
      </div>
    </header>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="bg-error/10 border border-error/40 rounded-xl p-4 text-sm text-error">{{ error }}</div>

    <div v-else-if="data?.user" class="space-y-6">
      <section class="bg-surface-soft border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="col-span-2 md:col-span-1 flex items-center gap-3">
          <UserAvatar :user="data.user" :size="48" />
          <div class="min-w-0">
            <div class="font-semibold truncate">{{ userLabel(data.user) }}</div>
            <div class="text-[11px] text-muted truncate">{{ data.user.username || '—' }}</div>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Status') }}</div>
          <div class="mt-1 flex flex-wrap gap-1">
            <CellBadge v-if="data.user.suspendedAt" variant="status" value="suspended" />
            <CellBadge v-else variant="status" value="active" />
            <span v-if="data.user.isSuperAdmin" class="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">{{ t('Superadmin') }}</span>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('First login') }}</div>
          <div class="mt-1 text-xs"><CellTimestamp :value="data.user.firstLoginAt" mode="absolute" /></div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Last seen') }}</div>
          <div class="mt-1 text-xs"><CellTimestamp :value="data.user.lastSeenAt" mode="relative" /></div>
        </div>
        <div v-if="data.user.companyName" class="col-span-2 md:col-span-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Company') }}</div>
          <div class="mt-1 text-sm">{{ data.user.companyName }}</div>
        </div>
      </section>

      <section v-if="data.aggregate" class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          :label="t('Total runs')"
          :value="data.aggregate.run_count ?? 0"
          :sublabel="`${data.aggregate.single_page_runs ?? 0} ${t('single')} · ${data.aggregate.site_wide_runs ?? 0} ${t('site-wide')}`"
        />
        <KpiTile :label="t('Unique sites')"   :value="data.aggregate.unique_origins ?? 0" />
        <KpiTile :label="t('Errors caught')"  :value="data.aggregate.error_total ?? 0"   tone="error" />
        <KpiTile :label="t('Warnings caught')" :value="data.aggregate.warning_total ?? 0" />
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <header class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-sm">{{ t('Roles') }}</h3>
            <BaseButton
              v-if="canWriteUsers && !data.user.isSuperAdmin"
              variant="pill"
              :icon="editingRoles ? 'mdiClose' : 'mdiPencil'"
              :icon-size="11"
              @click="editingRoles ? (editingRoles = false) : startEditRoles()"
            >
              {{ editingRoles ? t('Cancel') : t('Edit') }}
            </BaseButton>
          </header>
          <template v-if="editingRoles">
            <div class="flex flex-wrap gap-1.5 mb-3">
              <button
                v-for="r in rolesState.roles" :key="r.id"
                @click="toggleRole(r.id)"
                class="text-[10px] px-2 py-1 rounded-full border transition-colors"
                :class="draftRoles.includes(r.id)
                  ? 'bg-primary text-black/80 border-primary'
                  : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
              >{{ r.name }}</button>
            </div>
            <div class="flex justify-end">
              <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="saveRoles">{{ t('Save') }}</BaseButton>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="r in (data.user.roles ?? [])" :key="r"
                class="text-[11px] px-1.5 py-0.5 rounded bg-surface text-light"
              >{{ rolesState.roles.find(role => role.id === r)?.name ?? r }}</span>
              <span v-if="!data.user.roles?.length" class="text-[11px] text-muted/60 italic">{{ t('No roles assigned.') }}</span>
            </div>
          </template>
        </section>

        <section class="bg-surface-soft border border-border rounded-xl p-4">
          <header class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-sm">{{ t('Admin note') }}</h3>
            <BaseButton
              v-if="canWriteUsers"
              variant="pill"
              :icon="editingNote ? 'mdiClose' : 'mdiPencil'"
              :icon-size="11"
              @click="editingNote ? (editingNote = false, noteDraft = data.user.adminNote ?? '') : (editingNote = true)"
            >
              {{ editingNote ? t('Cancel') : t('Edit') }}
            </BaseButton>
          </header>
          <template v-if="editingNote">
            <TextareaField
              v-model="noteDraft"
              :rows="4"
              :placeholder="t('Internal note about this user — not visible to the user themselves.')"
            />
            <div class="mt-2 flex justify-end">
              <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="saveNote">{{ t('Save') }}</BaseButton>
            </div>
          </template>
          <p v-else-if="data.user.adminNote" class="text-sm text-light whitespace-pre-wrap">{{ data.user.adminNote }}</p>
          <p v-else class="text-sm text-muted/60 italic">{{ t('No note yet.') }}</p>
        </section>
      </div>

      <div>
        <h3 class="font-semibold text-sm mb-2">{{ t('Top sites checked') }}</h3>
        <DataTable
          :rows="data.topSites ?? []"
          :columns="sitesColumns"
          :on-row-click="openSite"
          :empty-text="t('No sites yet.')"
          :row-key="s => s.origin"
          dense
          min-width="600px"
        >
          <template #cell-origin="{ row }"><CellOrigin :value="row.origin" /></template>
          <template #cell-runs="{ row }"><CellNumber :value="row.run_count" /></template>
          <template #cell-errors="{ row }"><CellNumber :value="row.error_total" error-when="> 0" /></template>
          <template #cell-lastRun="{ row }"><CellTimestamp :value="row.last_run_at" mode="relative" /></template>
        </DataTable>
      </div>

      <div>
        <h3 class="font-semibold text-sm mb-2">{{ t('Recent runs') }}</h3>
        <DataTable
          :rows="data.recentRuns ?? []"
          :columns="runsColumns"
          :on-row-click="openRun"
          :empty-text="t('No runs by this user yet.')"
          dense
          min-width="900px"
        >
          <template #cell-when="{ row }"><CellTimestamp :value="row.started_at" mode="both" /></template>
          <template #cell-origin="{ row }"><CellOrigin :value="row.origin" /></template>
          <template #cell-kind="{ row }">
            <CellBadge
              :value="row.kind"
              :label="row.kind === 'site-wide' ? t('Site-wide') : t('Single')"
              :class-name="row.kind === 'site-wide' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
            />
          </template>
          <template #cell-status="{ row }"><CellBadge variant="status" :value="row.status" /></template>
          <template #cell-errors="{ row }"><CellNumber :value="row.total_errors" error-when="> 0" /></template>
          <template #cell-warnings="{ row }"><CellNumber :value="row.total_warnings" muted-when=">= 0" /></template>
        </DataTable>
      </div>

      <details class="bg-surface-soft border border-border rounded-xl">
        <summary class="px-4 py-3 cursor-pointer text-sm font-semibold">
          {{ t('All recent activity events ({n})', { n: data.recentEvents?.length ?? 0 }) }}
        </summary>
        <div class="p-3">
          <DataTable
            :rows="data.recentEvents ?? []"
            :columns="eventsColumns"
            :empty-text="t('No events yet.')"
            dense
            min-width="600px"
          >
            <template #cell-when="{ row }"><CellTimestamp :value="row.created_at" mode="both" /></template>
            <template #cell-type="{ row }"><CellCode :value="row.type" /></template>
            <template #cell-target="{ row }">{{ row.target ?? '—' }}</template>
          </DataTable>
        </div>
      </details>
    </div>
  </div>
</template>
