<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useToast }  from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminGroups } from '@/admin/modules/groups/composables/useAdminGroups.js'

const router = useRouter()
const { t }  = useI18n()
const toast  = useToast()
const { has } = usePermissions()
const { state, fetchAll, create, remove } = useAdminGroups()

const canWrite = () => has('admin.groups.write')

const createOpen = ref(false)
const draft = ref({ id: '', name: '', description: '' })

onMounted(fetchAll)

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/[äöüß]/g, (m) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[m]))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function openCreate() {
  draft.value = { id: '', name: '', description: '' }
  createOpen.value = true
}

async function submitCreate() {
  if (!draft.value.name.trim()) return
  const id = draft.value.id.trim() || slugify(draft.value.name)

  // Mirror the backend slug rule (`^[a-z0-9-]+$`, 2-64) client-side so the
  // user gets a precise hint instead of an opaque 400 from the server.
  if (id.length < 2 || id.length > 64) {
    toast.error(t('Slug must be 2–64 characters long.'))
    return
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    toast.error(t('Slug may only contain lowercase letters, digits and hyphens.'))
    return
  }

  try {
    const group = await create({
      id,
      name:        draft.value.name.trim(),
      description: draft.value.description.trim() || null,
    })
    createOpen.value = false
    toast.success(t('Group created'))
    router.push({ name: 'admin-group-detail', params: { id: group.id } })
  } catch (e) {
    if (e.status === 409) toast.error(t('Slug already in use'))
    else                  toast.error(e.message)
  }
}

async function onDelete(group) {
  if (!confirm(t('Delete group "{n}"? Members are unassigned (the users themselves stay).', { n: group.name }))) return
  try {
    await remove(group.id)
    toast.success(t('Group deleted'))
  } catch (e) {
    if (e.status === 409) toast.error(t('System groups cannot be deleted.'))
    else                  toast.error(e.message)
  }
}

const columns = [
  { key: 'name',    label: 'Name',    minWidth: 200 },
  { key: 'members', label: 'Members', minWidth: 90,  align: 'right' },
  { key: 'created', label: 'Created', minWidth: 130 },
]

function openDetail(g) {
  router.push({ name: 'admin-group-detail', params: { id: g.id } })
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Groups') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Bundle users into teams or departments. Groups carry no permissions — they\'re just a way to address a set of users when restricting visibility on a resource (e.g. who can pick a check-type).') }}
        </p>
      </div>
      <BaseButton
        v-if="canWrite()"
        variant="pill"
        icon="mdiPlus"
        :icon-size="13"
        class="bg-primary! border-primary! text-black/80!"
        @click="openCreate"
      >{{ t('New group') }}</BaseButton>
    </header>

    <DataTable
      :rows="state.groups"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openDetail"
      :row-key="g => g.id"
      :empty-text="t('No groups yet. Create one above.')"
      min-width="700px"
    >
      <template #cell-name="{ row }">
        <div class="min-w-0">
          <div class="font-medium truncate flex items-center gap-1.5">
            <span class="truncate">{{ row.name }}</span>
            <span v-if="row.system" class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">{{ t('System') }}</span>
          </div>
          <code class="text-[10px] text-muted/60 font-mono">{{ row.id }}</code>
          <div v-if="row.description" class="text-[10px] text-muted/70 mt-0.5 truncate">{{ row.description }}</div>
        </div>
      </template>
      <template #cell-members="{ row }"><CellNumber :value="row.memberCount" muted-when="== 0" /></template>
      <template #cell-created="{ row }"><CellTimestamp :value="row.createdAt" mode="relative" /></template>
      <template #row-actions="{ row }">
        <BaseButton
          v-if="canWrite() && !row.system"
          variant="icon-error"
          icon="mdiDelete"
          :icon-size="16"
          :tooltip="t('Delete')"
          @click="onDelete(row)"
        />
        <BaseButton
          v-else-if="canWrite() && row.system"
          variant="icon"
          icon="mdiLockOutline"
          :icon-size="16"
          :tooltip="t('System group — cannot be deleted')"
          disabled
        />
      </template>
    </DataTable>

    <BaseModal :open="createOpen" size="md" :title="t('New group')" @update:open="createOpen = $event">
      <div class="space-y-3">
        <FormField v-model="draft.name" :label="t('Display name')" :placeholder="t('Group name')" />
        <FormField v-model="draft.id" mono :label="t('Slug (URL-safe identifier — auto-generated if empty)')" :placeholder="slugify(draft.name) || 'team-basti'" />
        <TextareaField v-model="draft.description" :rows="2" :label="t('Description (optional)')" :placeholder="t('What is this group for…')" />
      </div>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <BaseButton variant="ghost" @click="createOpen = false">{{ t('Cancel') }}</BaseButton>
          <BaseButton class="bg-primary! border-primary! text-black/80!" :disabled="!draft.name.trim() || state.busy" @click="submitCreate">{{ t('Create + edit') }}</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
