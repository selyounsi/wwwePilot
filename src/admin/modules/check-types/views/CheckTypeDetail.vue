<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminCheckTypes } from '@/admin/modules/check-types/composables/useAdminCheckTypes.js'
import { useAdminRoles } from '@/admin/modules/roles/composables/useAdminRoles.js'
import { useAdminUsers } from '@/admin/modules/users/composables/useAdminUsers.js'
import { useAdminGroups } from '@/admin/modules/groups/composables/useAdminGroups.js'
import { useFeatureFlags } from '@/composables/useFeatureFlags.js'

const route   = useRoute()
const router  = useRouter()
const { t }   = useI18n()
const toast   = useToast()
const { has } = usePermissions()
const {
  state, fetchOne, update,
  addTask, updateTask, removeTask, reorderTasks,
} = useAdminCheckTypes()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()
const { state: usersState, fetchAll: fetchUsers } = useAdminUsers()
const { state: groupsState, fetchAll: fetchGroups } = useAdminGroups()
const { isEnabled: isFlagEnabled } = useFeatureFlags()

// True when the module is gated off via the global feature-flag system.
// We still let the admin toggle it in the module set (the flag may flip
// back on), but the pill is dimmed and gets an explicit lock icon so the
// admin knows the module won't actually run right now.
function isModuleGloballyOff(slug) {
  return !isFlagEnabled(`module.web-checker.${slug}`)
}

// Canonical list of web-checker modules. Kept in sync with the
// `module.web-checker.*` feature-flag seed in the backend. When a module
// is added there, also add it here so admins can tick it.
const KNOWN_MODULES = [
  'accessibility', 'console', 'contrast', 'headings', 'images',
  'links', 'overview', 'performance', 'privacy', 'sitemap',
  'spellcheck', 'structured-data', 'validation',
]

const canWrite = computed(() => has('admin.check-types.write'))

const id = computed(() => String(route.params.id ?? ''))

// Editable draft kept separate from the canonical state so the UI doesn't
// double-fetch on every keystroke. Synced from `state.current` on load.
const draft = ref({
  name: '', slug: '', description: '',
  moduleIds: [], roleIds: [], userIds: [], groupIds: [], enabled: true,
  isDefault: false,
})

const userSearch = ref('')

const isDefaultType = computed(() => draft.value.isDefault)
const dirty = ref(false)
const newTaskOpen = ref(false)
const newTask     = ref({ label: '', description: '' })
const editingTaskId = ref(null)
const editDraft     = ref({ label: '', description: '' })

async function load() {
  if (!id.value) return
  try {
    const { type } = await fetchOne(id.value)
    draft.value = {
      name:        type.name,
      slug:        type.slug,
      description: type.description ?? '',
      moduleIds:   [...(type.moduleIds ?? [])],
      roleIds:     [...(type.roleIds ?? [])],
      userIds:     [...(type.userIds ?? [])],
      groupIds:    [...(type.groupIds ?? [])],
      enabled:     type.enabled,
      isDefault:   !!type.isDefault,
    }
    dirty.value = false
  } catch (e) {
    toast.error(e.message)
  }
}

onMounted(() => {
  load()
  if (!rolesState.roles.length)  fetchRoles()
  if (!usersState.users.length)  fetchUsers()
  if (!groupsState.groups.length) fetchGroups()
})
watch(id, load)

function toggleModule(slug) {
  const i = draft.value.moduleIds.indexOf(slug)
  if (i >= 0) draft.value.moduleIds.splice(i, 1)
  else        draft.value.moduleIds.push(slug)
  dirty.value = true
}

function toggleRole(roleId) {
  const i = draft.value.roleIds.indexOf(roleId)
  if (i >= 0) draft.value.roleIds.splice(i, 1)
  else        draft.value.roleIds.push(roleId)
  dirty.value = true
}

function toggleUser(userId) {
  const i = draft.value.userIds.indexOf(userId)
  if (i >= 0) draft.value.userIds.splice(i, 1)
  else        draft.value.userIds.push(userId)
  dirty.value = true
}

function toggleGroup(groupId) {
  const i = draft.value.groupIds.indexOf(groupId)
  if (i >= 0) draft.value.groupIds.splice(i, 1)
  else        draft.value.groupIds.push(groupId)
  dirty.value = true
}

function userLabel(u) {
  if (!u) return '—'
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email || u.id.slice(0, 8)
}

// Selected users always shown at the top of the picker, the rest is
// filtered by the search input. Limits to 50 results to keep the DOM
// snappy when there are hundreds of users.
const filteredUsers = computed(() => {
  const q = userSearch.value.toLowerCase().trim()
  const all = usersState.users ?? []
  const selectedSet = new Set(draft.value.userIds)
  const matches = q
    ? all.filter(u =>
        (u.email     ?? '').toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName  ?? '').toLowerCase().includes(q) ||
        (u.name      ?? '').toLowerCase().includes(q),
      )
    : all
  // Selected first, then the rest. De-dupe via id.
  const seen = new Set()
  const out = []
  for (const id of draft.value.userIds) {
    const u = all.find(x => x.id === id)
    if (u && !seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  for (const u of matches) {
    if (!seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  return { rows: out.slice(0, 50), total: out.length, selectedSet }
})

async function save() {
  try {
    await update(id.value, {
      name:        draft.value.name,
      slug:        draft.value.slug,
      description: draft.value.description || null,
      moduleIds:   draft.value.moduleIds,
      roleIds:     draft.value.roleIds,
      userIds:     draft.value.userIds,
      groupIds:    draft.value.groupIds,
      enabled:     draft.value.enabled,
    })
    toast.success(t('Check-type saved'))
    dirty.value = false
  } catch (e) {
    if (e.status === 409) toast.error(t('Slug already in use'))
    else                  toast.error(e.message)
  }
}

async function onAddTask() {
  if (!newTask.value.label.trim()) return
  try {
    await addTask(id.value, {
      label:       newTask.value.label.trim(),
      description: newTask.value.description.trim() || null,
    })
    newTask.value = { label: '', description: '' }
    newTaskOpen.value = false
    toast.success(t('Task added'))
  } catch (e) { toast.error(e.message) }
}

function startEditTask(task) {
  editingTaskId.value = task.id
  editDraft.value = { label: task.label, description: task.description ?? '' }
}

async function saveEditTask() {
  if (!editDraft.value.label.trim()) return
  try {
    await updateTask(id.value, editingTaskId.value, {
      label:       editDraft.value.label.trim(),
      description: editDraft.value.description.trim() || null,
    })
    editingTaskId.value = null
    toast.success(t('Task saved'))
  } catch (e) { toast.error(e.message) }
}

async function onRemoveTask(task) {
  if (!confirm(t('Delete task "{l}"?', { l: task.label }))) return
  try {
    await removeTask(id.value, task.id)
    toast.success(t('Task removed'))
  } catch (e) { toast.error(e.message) }
}

async function moveTask(task, direction) {
  const ordered = [...state.current.tasks].sort((a, b) => a.position - b.position)
  const idx = ordered.findIndex(t => t.id === task.id)
  if (idx < 0) return
  const targetIdx = idx + direction
  if (targetIdx < 0 || targetIdx >= ordered.length) return
  ;[ordered[idx], ordered[targetIdx]] = [ordered[targetIdx], ordered[idx]]
  await reorderTasks(id.value, ordered.map(t => t.id))
}

watch(draft, () => { dirty.value = true }, { deep: true })
</script>

<template>
  <div class="p-6 space-y-6">
    <header class="flex items-center gap-3 flex-wrap">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.push({ name: 'admin-check-types' })">
        {{ t('Back') }}
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate flex items-center gap-2">
          {{ draft.name || t('Check-type') }}
          <span v-if="isDefaultType" class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-normal">{{ t('Standard') }}</span>
        </h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ draft.slug }}</p>
      </div>
      <BaseButton
        v-if="canWrite"
        class="bg-primary! border-primary! text-black/80!"
        :disabled="!dirty || state.busy"
        @click="save"
      >{{ dirty ? t('Save changes') : t('Saved') }}</BaseButton>
    </header>

    <div v-if="!state.current" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <BaseCard :title="t('Profile')" divided>
        <div class="space-y-3">
          <FormField v-model="draft.name" :label="t('Display name')" :disabled="!canWrite" />
          <FormField
            v-model="draft.slug"
            mono
            :label="t('Slug')"
            :disabled="!canWrite || isDefaultType"
            :helper-text="isDefaultType ? t('Slug is locked for the default type.') : ''"
          />
          <TextareaField v-model="draft.description" :rows="2" :label="t('Description (optional)')" :disabled="!canWrite" :placeholder="t('When to use this type, what it covers…')" />
          <CheckboxField
            v-model="draft.enabled"
            :label="isDefaultType
              ? t('Show in the web-checker (uncheck to hide the default check)')
              : t('Enabled — auditors can pick this type')"
            :disabled="!canWrite"
          />
        </div>
      </BaseCard>

      <BaseCard :title="t('Modules')" :subtitle="t('Which automated checks run when this type is selected')" divided>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="m in KNOWN_MODULES" :key="m"
            class="text-[11px] px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1"
            :class="[
              draft.moduleIds.includes(m)
                ? 'bg-primary text-black/80 border-primary'
                : 'bg-surface border-border text-muted hover:bg-surface-soft-hover',
              isModuleGloballyOff(m) && 'opacity-50',
            ]"
            :disabled="!canWrite"
            :title="isModuleGloballyOff(m) ? t('Feature flag off — module will be skipped at runtime') : null"
            @click="canWrite && toggleModule(m)"
          >
            <Icon v-if="isModuleGloballyOff(m)" name="mdiLockOutline" :size="10" />
            <span>{{ m }}</span>
          </button>
        </div>
        <p v-if="!draft.moduleIds.length" class="mt-3 text-[10px] text-alert">
          <Icon name="mdiAlertCircleOutline" :size="11" class="inline -mt-0.5" />
          {{ t('No modules selected — picking this type in the web-checker will produce no automated results.') }}
        </p>
        <p v-if="draft.moduleIds.some(m => isModuleGloballyOff(m))" class="mt-2 text-[10px] text-muted/70">
          <Icon name="mdiLockOutline" :size="11" class="inline -mt-0.5" />
          {{ t('Locked modules are currently disabled via feature-flags. They stay in the profile but are skipped at runtime until the flag is re-enabled.') }}
        </p>
      </BaseCard>

      <BaseCard :title="t('Visible to')" :subtitle="t('Empty = everyone. Combine roles AND individual users to grant access — anyone matching either condition can pick this type.')" divided>
        <div class="space-y-3">
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1.5">{{ t('Roles') }}</div>
            <div v-if="rolesState.roles.length" class="flex flex-wrap gap-1.5">
              <button
                v-for="r in rolesState.roles" :key="r.id"
                class="text-[11px] px-2.5 py-1 rounded-full border transition-colors"
                :class="draft.roleIds.includes(r.id)
                  ? 'bg-primary text-black/80 border-primary'
                  : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
                :disabled="!canWrite"
                @click="canWrite && toggleRole(r.id)"
              >{{ r.name }}</button>
            </div>
            <p v-else class="text-[11px] text-muted/60 italic">{{ t('No roles defined yet.') }}</p>
          </div>

          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1.5">{{ t('Groups') }}</div>
            <div v-if="groupsState.groups.length" class="flex flex-wrap gap-1.5">
              <button
                v-for="g in groupsState.groups" :key="g.id"
                class="text-[11px] px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1"
                :class="draft.groupIds.includes(g.id)
                  ? 'bg-primary text-black/80 border-primary'
                  : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
                :disabled="!canWrite"
                @click="canWrite && toggleGroup(g.id)"
              >
                <Icon name="mdiAccountGroupOutline" :size="10" />
                <span>{{ g.name }}</span>
                <span class="text-[9px] opacity-70 tabular-nums">{{ g.memberCount }}</span>
              </button>
            </div>
            <p v-else class="text-[11px] text-muted/60 italic">{{ t('No groups defined yet.') }}</p>
          </div>

          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1.5 flex items-center justify-between gap-2">
              <span>{{ t('Individual users') }}</span>
              <span v-if="draft.userIds.length" class="text-muted/60 normal-case tracking-normal">
                {{ t('{n} selected', { n: draft.userIds.length }) }}
              </span>
            </div>
            <FormField
              v-model="userSearch"
              dense
              prefix-icon="mdiMagnify"
              :placeholder="t('Search by email or name…')"
              :disabled="!canWrite"
            />
            <div class="mt-2 max-h-60 overflow-y-auto border border-border rounded-lg bg-surface divide-y divide-border/30">
              <label
                v-for="u in filteredUsers.rows" :key="u.id"
                class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-soft-hover transition-colors"
                :class="filteredUsers.selectedSet.has(u.id) && 'bg-primary/5'"
              >
                <input
                  type="checkbox"
                  :checked="filteredUsers.selectedSet.has(u.id)"
                  :disabled="!canWrite"
                  class="accent-primary"
                  @change="toggleUser(u.id)"
                />
                <UserAvatar :user="u" :size="20" />
                <div class="flex-1 min-w-0">
                  <div class="text-xs truncate">{{ userLabel(u) }}</div>
                  <div v-if="u.email && u.email !== userLabel(u)" class="text-[10px] text-muted/60 truncate">{{ u.email }}</div>
                </div>
              </label>
              <p v-if="!filteredUsers.rows.length" class="px-3 py-3 text-[11px] text-muted/60 italic text-center">
                {{ userSearch.trim() ? t('No matching users.') : t('No users loaded yet.') }}
              </p>
            </div>
            <p v-if="filteredUsers.total > filteredUsers.rows.length" class="mt-1 text-[10px] text-muted/60">
              {{ t('Showing first {n} matches — refine the search to see more.', { n: filteredUsers.rows.length }) }}
            </p>
          </div>
        </div>

        <p v-if="!draft.roleIds.length && !draft.userIds.length && !draft.groupIds.length" class="mt-3 text-[10px] text-muted">
          <Icon name="mdiInformationOutline" :size="11" class="inline -mt-0.5" />
          {{ t('Visible to every authenticated user.') }}
        </p>
      </BaseCard>

      <BaseCard :title="t('Manual tasks')" :subtitle="t('Items the auditor ticks off + can comment on. State is saved per URL.')" divided>
        <template #actions>
          <BaseButton
            v-if="canWrite && !newTaskOpen"
            variant="pill" icon="mdiPlus" :icon-size="11"
            @click="newTaskOpen = true"
          >{{ t('Add task') }}</BaseButton>
        </template>

        <div v-if="newTaskOpen" class="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/30 space-y-2">
          <FormField v-model="newTask.label" :label="t('Task label')" :placeholder="t('e.g. Impressum on every page')" />
          <TextareaField v-model="newTask.description" :rows="2" :label="t('Help text (optional)')" :placeholder="t('Hint for the auditor — when this is met, what to look for…')" />
          <div class="flex justify-end gap-2">
            <BaseButton variant="ghost" @click="newTaskOpen = false">{{ t('Cancel') }}</BaseButton>
            <BaseButton
              class="bg-primary! border-primary! text-black/80!"
              :disabled="!newTask.label.trim() || state.busy"
              @click="onAddTask"
            >{{ t('Add') }}</BaseButton>
          </div>
        </div>

        <ItemList
          :items="[...state.current.tasks].sort((a,b) => a.position - b.position)"
          :empty-text="t('No tasks yet. Add the manual checks every auditor should run through.')"
        >
          <template #item="{ item: task, index }">
            <ItemListRow>
              <div class="flex-1 min-w-0">
                <template v-if="editingTaskId === task.id">
                  <FormField v-model="editDraft.label" dense />
                  <TextareaField v-model="editDraft.description" dense :rows="2" class="mt-1" />
                  <div class="flex gap-1 mt-1">
                    <BaseButton variant="pill" @click="editingTaskId = null">{{ t('Cancel') }}</BaseButton>
                    <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="saveEditTask">{{ t('Save') }}</BaseButton>
                  </div>
                </template>
                <template v-else>
                  <div class="text-sm">{{ task.label }}</div>
                  <div v-if="task.description" class="text-[11px] text-muted/70 mt-0.5">{{ task.description }}</div>
                </template>
              </div>
              <template v-if="canWrite && editingTaskId !== task.id">
                <BaseButton variant="icon" icon="mdiArrowUp" :icon-size="13" :disabled="index === 0" @click="moveTask(task, -1)" />
                <BaseButton variant="icon" icon="mdiArrowDown" :icon-size="13" :disabled="index === state.current.tasks.length - 1" @click="moveTask(task, 1)" />
                <BaseButton variant="icon" icon="mdiPencil" :icon-size="13" @click="startEditTask(task)" />
                <BaseButton variant="icon-error" icon="mdiDelete" :icon-size="13" @click="onRemoveTask(task)" />
              </template>
            </ItemListRow>
          </template>
        </ItemList>
      </BaseCard>
    </div>
  </div>
</template>
