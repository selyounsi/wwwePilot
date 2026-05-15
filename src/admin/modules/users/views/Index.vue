<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter }      from 'vue-router'
import { useI18n }        from '@/composables/i18n/useI18n.js'
import { useToast }       from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminUsers } from '@/admin/modules/users/composables/useAdminUsers.js'
import { useAdminRoles } from '@/admin/modules/roles/composables/useAdminRoles.js'
import { useTableExport } from '@/admin/composables/useTableExport.js'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { state: usersState, fetchAll: fetchUsers, setRoles, suspend, unsuspend } = useAdminUsers()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()
const { canWriteUsers } = usePermissions()

const search    = ref('')
const editingId = ref(null)
const draftRoles = ref([])

onMounted(() => {
  fetchUsers()
  fetchRoles()
})

const filteredUsers = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return usersState.users
  return usersState.users.filter(u =>
    (u.email      ?? '').toLowerCase().includes(q) ||
    (u.name       ?? '').toLowerCase().includes(q) ||
    (u.firstName  ?? '').toLowerCase().includes(q) ||
    (u.lastName   ?? '').toLowerCase().includes(q) ||
    (u.companyName?? '').toLowerCase().includes(q),
  )
})

function startEditRoles(user) {
  editingId.value  = user.id
  draftRoles.value = [...(user.roles ?? [])]
}

function toggleRole(roleId) {
  const arr = draftRoles.value
  const i   = arr.indexOf(roleId)
  if (i >= 0) arr.splice(i, 1)
  else        arr.push(roleId)
}

async function saveRoles() {
  try {
    await setRoles(editingId.value, draftRoles.value)
    toast.success(t('Roles updated'))
    editingId.value = null
  } catch (e) {
    toast.error(e.message)
  }
}

async function onSuspend(user) {
  if (!confirm(t('Suspend {name}?', { name: user.email || user.id }))) return
  try {
    await suspend(user.id)
    toast.success(t('User suspended'))
  } catch (e) { toast.error(e.message) }
}

async function onUnsuspend(user) {
  try {
    await unsuspend(user.id)
    toast.success(t('User reactivated'))
  } catch (e) { toast.error(e.message) }
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
  if (d < 30)     return t('{n} d ago', { n: d })
  return new Date(ts).toLocaleDateString()
}

function openUser(id) {
  if (editingId.value === id) return  // editing in-place, don't navigate
  router.push({ name: 'admin-user-detail', params: { id } })
}

const { exportCSV } = useTableExport()
function downloadCSV() {
  exportCSV({
    rows:     filteredUsers.value,
    filename: `users-${new Date().toISOString().slice(0, 10)}.csv`,
    columns:  [
      { key: 'email',       label: 'Email' },
      { key: 'firstName',   label: 'First name' },
      { key: 'lastName',    label: 'Last name' },
      { key: 'roles',       label: 'Roles',     get: (u) => (u.roles ?? []).join('|') },
      { key: 'suspendedAt', label: 'Suspended', get: (u) => u.suspendedAt ? 'yes' : 'no' },
      { key: 'lastSeenAt',  label: 'Last seen' },
      { key: 'firstLoginAt',label: 'First login' },
    ],
  })
}
</script>

<template>
  <div class="p-6">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold">{{ t('Users') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('{n} users — sorted by last activity', { n: usersState.users.length }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="search"
          type="search"
          :placeholder="t('Search by email, name, company…')"
          class="bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:border-primary/60"
        />
        <BaseButton
          variant="pill"
          icon="mdiDownload"
          :icon-size="13"
          :tooltip="t('Export as CSV')"
          @click="downloadCSV"
        >CSV</BaseButton>
      </div>
    </header>

    <div v-if="usersState.loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="usersState.error" class="bg-error/10 border border-error/40 rounded-xl p-4">
      <p class="text-sm text-error">{{ usersState.error }}</p>
    </div>

    <div v-else class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('User') }}</th>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Roles') }}</th>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Last seen') }}</th>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Status') }}</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="u in filteredUsers" :key="u.id"
            @click="openUser(u.id)"
            class="border-t border-border/40 hover:bg-surface-soft-hover cursor-pointer"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <UserAvatar :user="u" :size="32" />
                <div class="min-w-0">
                  <div class="font-medium truncate">
                    {{ u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.name || u.email) }}
                    <span v-if="u.isSuperAdmin" class="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">{{ t('Superadmin') }}</span>
                  </div>
                  <div class="text-[11px] text-muted truncate">{{ u.email }}</div>
                </div>
              </div>
            </td>

            <td class="px-4 py-3 align-middle">
              <template v-if="editingId === u.id">
                <div class="flex flex-wrap gap-1 max-w-md">
                  <button
                    v-for="r in rolesState.roles" :key="r.id"
                    @click="toggleRole(r.id)"
                    class="text-[10px] px-2 py-1 rounded-full border transition-colors"
                    :class="draftRoles.includes(r.id)
                      ? 'bg-primary text-black/80 border-primary'
                      : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
                  >{{ r.name }}</button>
                </div>
              </template>
              <template v-else>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="r in u.roles ?? []" :key="r"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
                  >{{ rolesState.roles.find(role => role.id === r)?.name ?? r }}</span>
                  <span v-if="!u.roles?.length && !u.isSuperAdmin" class="text-[11px] text-muted/60 italic">{{ t('none') }}</span>
                </div>
              </template>
            </td>

            <td class="px-4 py-3 text-[11px] text-muted">{{ relative(u.lastSeenAt) }}</td>

            <td class="px-4 py-3">
              <span
                v-if="u.suspendedAt"
                class="text-[10px] px-1.5 py-0.5 rounded bg-error/15 text-error"
              >{{ t('Suspended') }}</span>
              <span
                v-else
                class="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success"
              >{{ t('Active') }}</span>
            </td>

            <td class="px-4 py-3 text-right whitespace-nowrap" @click.stop>
              <div class="inline-flex gap-1">
                <template v-if="editingId === u.id">
                  <BaseButton variant="pill" @click="editingId = null">{{ t('Cancel') }}</BaseButton>
                  <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="saveRoles">{{ t('Save') }}</BaseButton>
                </template>
                <template v-else-if="canWriteUsers && !u.isSuperAdmin">
                  <BaseButton variant="pill" icon="mdiAccountEdit" :icon-size="11" @click="startEditRoles(u)">
                    {{ t('Edit roles') }}
                  </BaseButton>
                  <BaseButton
                    v-if="u.suspendedAt"
                    variant="pill"
                    icon="mdiAccountCheck"
                    :icon-size="11"
                    class="text-success! border-success/30! hover:bg-success/10!"
                    @click="onUnsuspend(u)"
                  >{{ t('Reactivate') }}</BaseButton>
                  <BaseButton
                    v-else
                    variant="pill"
                    icon="mdiAccountCancel"
                    :icon-size="11"
                    class="text-error! border-error/30! hover:bg-error/10!"
                    @click="onSuspend(u)"
                  >{{ t('Suspend') }}</BaseButton>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="filteredUsers.length === 0" class="text-center text-muted py-8 text-sm">
        {{ t('No users match the filter.') }}
      </p>
    </div>
  </div>
</template>
