<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }        from '@/composables/i18n/useI18n.js'
import { useToast }       from '@/composables/useToast.js'
import { useAdminUsers }  from '@/admin/composables/useAdminUsers.js'
import { useAdminRoles }  from '@/admin/composables/useAdminRoles.js'
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

function formatTime(ts) { return ts ? new Date(ts).toLocaleString() : '—' }

function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return t('just now')
  if (min < 60) return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)   return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}

function statusColor(s) {
  switch (s) {
    case 'running':   return 'bg-primary/15 text-primary'
    case 'finished':  return 'bg-success/15 text-success'
    case 'cancelled': return 'bg-alert/15  text-alert'
    case 'aborted':   return 'bg-error/15  text-error'
    default:          return 'bg-surface   text-light'
  }
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

function openRun(runId) {
  router.push({ name: 'admin-run-detail', params: { id: runId } })
}

function openSite(origin) {
  router.push({ name: 'admin-site-detail', params: { origin: encodeURIComponent(origin) } })
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center gap-3">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.back()">
        {{ t('Back') }}
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate">{{ userLabel(data?.user) }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ data?.user?.email }} · {{ id }}</p>
      </div>
      <div v-if="canWriteUsers && data?.user && !data.user.isSuperAdmin" class="inline-flex gap-1">
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
      <!-- Profile + status -->
      <section class="bg-surface-soft border border-border rounded-xl p-4 grid grid-cols-4 gap-4">
        <div class="col-span-1 flex items-center gap-3">
          <UserAvatar :user="data.user" :size="48" />
          <div class="min-w-0">
            <div class="font-semibold truncate">{{ userLabel(data.user) }}</div>
            <div class="text-[11px] text-muted truncate">{{ data.user.username || '—' }}</div>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Status') }}</div>
          <div class="mt-1">
            <span v-if="data.user.suspendedAt" class="text-[11px] px-1.5 py-0.5 rounded bg-error/15 text-error">{{ t('Suspended') }}</span>
            <span v-else class="text-[11px] px-1.5 py-0.5 rounded bg-success/15 text-success">{{ t('Active') }}</span>
            <span v-if="data.user.isSuperAdmin" class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">{{ t('Superadmin') }}</span>
          </div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('First login') }}</div>
          <div class="mt-1 text-xs">{{ formatTime(data.user.firstLoginAt) }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Last seen') }}</div>
          <div class="mt-1 text-xs">{{ relative(data.user.lastSeenAt) }}</div>
        </div>
        <div v-if="data.user.companyName" class="col-span-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Company') }}</div>
          <div class="mt-1 text-sm">{{ data.user.companyName }}</div>
        </div>
      </section>

      <!-- Activity KPIs -->
      <section v-if="data.aggregate" class="grid grid-cols-4 gap-3">
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Total runs') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ data.aggregate.run_count ?? 0 }}</div>
          <div class="text-[11px] text-muted mt-1">
            {{ data.aggregate.single_page_runs ?? 0 }} {{ t('single') }} · {{ data.aggregate.site_wide_runs ?? 0 }} {{ t('site-wide') }}
          </div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Unique sites') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ data.aggregate.unique_origins ?? 0 }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Errors caught') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1 text-error">{{ data.aggregate.error_total ?? 0 }}</div>
        </div>
        <div class="bg-surface-soft border border-border rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Warnings caught') }}</div>
          <div class="text-2xl font-bold tabular-nums mt-1">{{ data.aggregate.warning_total ?? 0 }}</div>
        </div>
      </section>

      <!-- Roles + admin note -->
      <div class="grid grid-cols-2 gap-3">
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
            <textarea
              v-model="noteDraft"
              rows="4"
              :placeholder="t('Internal note about this user — not visible to the user themselves.')"
              class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:border-primary/60"
            />
            <div class="mt-2 flex justify-end">
              <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="saveNote">{{ t('Save') }}</BaseButton>
            </div>
          </template>
          <p v-else-if="data.user.adminNote" class="text-sm text-light whitespace-pre-wrap">{{ data.user.adminNote }}</p>
          <p v-else class="text-sm text-muted/60 italic">{{ t('No note yet.') }}</p>
        </section>
      </div>

      <!-- Top sites -->
      <section v-if="data.topSites?.length" class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60">
          <h3 class="font-semibold text-sm">{{ t('Top sites checked') }}</h3>
        </header>
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('Origin') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Runs') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Errors') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Last run') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in data.topSites" :key="s.origin"
              @click="openSite(s.origin)"
              class="border-t border-border/30 hover:bg-surface-soft-hover cursor-pointer"
            >
              <td class="px-4 py-2 text-[11px]">{{ shortHost(s.origin) }}</td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums">{{ s.run_count }}</td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums" :class="s.error_total > 0 && 'text-error'">{{ s.error_total }}</td>
              <td class="px-4 py-2 text-[11px] text-right text-muted">{{ relative(s.last_run_at) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Recent runs -->
      <section class="bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60">
          <h3 class="font-semibold text-sm">{{ t('Recent runs') }}</h3>
        </header>
        <table v-if="data.recentRuns?.length" class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('When') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Origin') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Kind') }}</th>
              <th class="text-left px-4 py-2 font-medium">{{ t('Status') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Errors') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Warnings') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in data.recentRuns" :key="r.id"
              @click="openRun(r.id)"
              class="border-t border-border/30 hover:bg-surface-soft-hover cursor-pointer"
            >
              <td class="px-4 py-2 text-[11px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(r.started_at) }}</td>
              <td class="px-4 py-2 text-[11px]">{{ shortHost(r.origin) }}</td>
              <td class="px-4 py-2">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="r.kind === 'site-wide' ? 'bg-primary/15 text-primary' : 'bg-surface text-light'"
                >{{ r.kind === 'site-wide' ? t('Site-wide') : t('Single') }}</span>
              </td>
              <td class="px-4 py-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded" :class="statusColor(r.status)">{{ r.status }}</span>
              </td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums" :class="r.total_errors > 0 && 'text-error'">{{ r.total_errors }}</td>
              <td class="px-4 py-2 text-[11px] text-right tabular-nums text-muted">{{ r.total_warnings }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-4 py-6 text-center text-sm text-muted">{{ t('No runs by this user yet.') }}</p>
      </section>

      <!-- Raw activity events -->
      <details class="bg-surface-soft border border-border rounded-xl">
        <summary class="px-4 py-3 cursor-pointer text-sm font-semibold">
          {{ t('All recent activity events ({n})', { n: data.recentEvents?.length ?? 0 }) }}
        </summary>
        <div class="px-4 py-3">
          <table v-if="data.recentEvents?.length" class="w-full text-xs">
            <thead class="text-[10px] uppercase tracking-wide text-muted/60">
              <tr>
                <th class="text-left font-medium pb-1">{{ t('When') }}</th>
                <th class="text-left font-medium pb-1">{{ t('Type') }}</th>
                <th class="text-left font-medium pb-1">{{ t('Target') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in data.recentEvents" :key="e.id" class="border-t border-border/20">
                <td class="py-1 text-[10px] text-muted whitespace-nowrap tabular-nums">{{ formatTime(e.created_at) }}</td>
                <td class="py-1 text-[10px]"><code>{{ e.type }}</code></td>
                <td class="py-1 text-[10px] truncate max-w-100">{{ e.target ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-sm text-muted text-center py-4">{{ t('No events yet.') }}</p>
        </div>
      </details>
    </div>
  </div>
</template>
