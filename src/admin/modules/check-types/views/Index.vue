<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useToast }  from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminCheckTypes } from '@/admin/modules/check-types/composables/useAdminCheckTypes.js'
import { useAdminRoles }      from '@/admin/modules/roles/composables/useAdminRoles.js'

const router = useRouter()
const { t }  = useI18n()
const toast  = useToast()
const { has } = usePermissions()
const { state, fetchAll, create, remove } = useAdminCheckTypes()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()

const canWrite = () => has('admin.check-types.write')

const createOpen = ref(false)
const draft = ref({ name: '', slug: '' })

onMounted(() => {
  fetchAll()
  if (!rolesState.roles.length) fetchRoles()
})

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/[äöüß]/g, (m) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[m]))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function openCreate() {
  draft.value = { name: '', slug: '' }
  createOpen.value = true
}

async function submitCreate() {
  if (!draft.value.name.trim()) return
  const slug = draft.value.slug.trim() || slugify(draft.value.name)
  try {
    const type = await create({
      name:       draft.value.name.trim(),
      slug,
      moduleIds:  [],
      roleIds:    [],
    })
    createOpen.value = false
    toast.success(t('Check-type created'))
    router.push({ name: 'admin-check-type-detail', params: { id: type.id } })
  } catch (e) {
    if (e.status === 409) toast.error(t('Slug already in use'))
    else                  toast.error(e.message)
  }
}

async function onDelete(type) {
  if (!confirm(t('Delete check-type "{n}"? This also removes all tasks and the auditors\' saved task-states.', { n: type.name }))) return
  try {
    await remove(type.id)
    toast.success(t('Check-type deleted'))
  } catch (e) { toast.error(e.message) }
}

const columns = [
  { key: 'name',      label: 'Name',      minWidth: 200 },
  { key: 'modules',   label: 'Modules',   minWidth: 200 },
  { key: 'roles',     label: 'Visible to', minWidth: 160 },
  { key: 'tasks',     label: 'Tasks',     minWidth: 70,  align: 'right' },
  { key: 'enabled',   label: 'Enabled',   minWidth: 90 },
]

function roleLabel(roleId) {
  return rolesState.roles.find(r => r.id === roleId)?.name ?? roleId
}

function openDetail(type) {
  router.push({ name: 'admin-check-type-detail', params: { id: type.id } })
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Check types') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Admin-defined audit profiles: bundle a module set + manual task checklist that auditors can pick in the web-checker. Optional role-gating restricts who sees a profile.') }}
        </p>
      </div>
      <BaseButton
        v-if="canWrite()"
        variant="pill"
        icon="mdiPlus"
        :icon-size="13"
        class="bg-primary! border-primary! text-black/80!"
        @click="openCreate"
      >{{ t('New check-type') }}</BaseButton>
    </header>

    <DataTable
      :rows="state.types"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openDetail"
      :empty-text="t('No check-types yet. Create your first profile above.')"
      min-width="900px"
    >
      <template #cell-name="{ row }">
        <div class="min-w-0">
          <div class="font-medium truncate">{{ row.name }}</div>
          <code class="text-[10px] text-muted/60 font-mono">{{ row.slug }}</code>
        </div>
      </template>

      <template #cell-modules="{ row }">
        <div class="flex flex-wrap gap-1">
          <code
            v-for="m in row.moduleIds.slice(0, 4)" :key="m"
            class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
          >{{ m }}</code>
          <span v-if="row.moduleIds.length > 4" class="text-[10px] text-muted">+{{ row.moduleIds.length - 4 }}</span>
          <span v-if="!row.moduleIds.length" class="text-[10px] text-muted/60 italic">{{ t('none — type will run nothing') }}</span>
        </div>
      </template>

      <template #cell-roles="{ row }">
        <div v-if="row.roleIds?.length" class="flex flex-wrap gap-1">
          <span
            v-for="r in row.roleIds" :key="r"
            class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary"
          >{{ roleLabel(r) }}</span>
        </div>
        <span v-else class="text-[10px] text-muted/60 italic">{{ t('everyone') }}</span>
      </template>

      <template #cell-tasks="{ row }">
        <CellNumber :value="row.taskCount" muted-when="== 0" />
      </template>

      <template #cell-enabled="{ row }">
        <CellBadge :value="row.enabled ? 'active' : 'inactive'" :variant="row.enabled ? 'status' : 'neutral'" />
      </template>

      <template #row-actions="{ row }">
        <BaseButton
          v-if="canWrite()"
          variant="icon-error"
          icon="mdiDelete"
          :icon-size="16"
          :tooltip="t('Delete')"
          @click="onDelete(row)"
        />
      </template>
    </DataTable>

    <BaseModal :open="createOpen" size="md" :title="t('New check-type')" @update:open="createOpen = $event">
      <div class="space-y-3">
        <FormField
          v-model="draft.name"
          :label="t('Display name')"
          :placeholder="t('e.g. Pre-Launch-Check')"
        />
        <FormField
          v-model="draft.slug"
          mono
          :label="t('Slug (URL-safe identifier — auto-generated if empty)')"
          :placeholder="slugify(draft.name) || 'pre-launch-check'"
        />
        <p class="text-[10px] text-muted/70">
          {{ t('After creation you can assign modules, define manual tasks, and restrict visibility to specific roles.') }}
        </p>
      </div>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <BaseButton variant="ghost" @click="createOpen = false">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            class="bg-primary! border-primary! text-black/80!"
            :disabled="!draft.name.trim() || state.busy"
            @click="submitCreate"
          >{{ t('Create + edit') }}</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
