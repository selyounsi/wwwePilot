<script setup>
import { onMounted, ref } from 'vue'
import { useI18n }        from '@/composables/i18n/useI18n.js'
import { useToast }       from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminRoles }  from '@/admin/composables/useAdminRoles.js'

const { t } = useI18n()
const toast = useToast()
const { state, fetchAll, create, update, remove } = useAdminRoles()
const { canWriteRoles } = usePermissions()

const editingId  = ref(null)
const draft      = ref(null)
const creating   = ref(false)
const newDraft   = ref({ id: '', name: '', description: '', permissions: [] })

onMounted(fetchAll)

function startEdit(role) {
  editingId.value = role.id
  draft.value = {
    name:        role.name,
    description: role.description ?? '',
    permissions: [...(role.permissions ?? [])],
  }
}

function toggleDraftPermission(slug) {
  const arr = draft.value.permissions
  const i   = arr.indexOf(slug)
  if (i >= 0) arr.splice(i, 1)
  else        arr.push(slug)
}

async function save(role) {
  try {
    const patch = { name: draft.value.name, description: draft.value.description }
    if (!role.system) patch.permissions = draft.value.permissions
    await update(role.id, patch)
    toast.success(t('Role saved'))
    editingId.value = null
  } catch (e) { toast.error(e.message) }
}

async function onDelete(role) {
  if (!confirm(t('Delete role {name}?', { name: role.name }))) return
  try {
    await remove(role.id)
    toast.success(t('Role deleted'))
  } catch (e) { toast.error(e.message) }
}

function toggleNewPermission(slug) {
  const arr = newDraft.value.permissions
  const i   = arr.indexOf(slug)
  if (i >= 0) arr.splice(i, 1)
  else        arr.push(slug)
}

async function createRole() {
  try {
    await create({ ...newDraft.value })
    toast.success(t('Role created'))
    creating.value = false
    newDraft.value = { id: '', name: '', description: '', permissions: [] }
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold">{{ t('Roles') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('{n} roles, {p} permissions in catalog', { n: state.roles.length, p: state.permissions.length }) }}
        </p>
      </div>
      <BaseButton v-if="canWriteRoles" variant="pill" icon="mdiPlus" :icon-size="13" @click="creating = true">
        {{ t('New role') }}
      </BaseButton>
    </header>

    <div v-if="state.loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4">
      <p class="text-sm text-error">{{ state.error }}</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-if="creating"
        class="bg-surface-soft border border-primary/40 rounded-xl p-4"
      >
        <div class="flex gap-3 mb-3">
          <input
            v-model="newDraft.id"
            :placeholder="t('slug-id (e.g. content-editor)')"
            class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/60"
          />
          <input
            v-model="newDraft.name"
            :placeholder="t('Display name')"
            class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary/60"
          />
        </div>
        <input
          v-model="newDraft.description"
          :placeholder="t('Description (optional)')"
          class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm mb-3 focus:outline-none focus:border-primary/60"
        />
        <div class="flex flex-wrap gap-1.5 mb-3">
          <button
            v-for="p in state.permissions" :key="p.id"
            @click="toggleNewPermission(p.id)"
            :title="p.description ?? ''"
            class="text-[10px] px-2 py-1 rounded-full border transition-colors"
            :class="newDraft.permissions.includes(p.id)
              ? 'bg-primary text-black/80 border-primary'
              : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
          >{{ p.id }}</button>
        </div>
        <div class="flex justify-end gap-2">
          <BaseButton variant="pill" @click="creating = false; newDraft = { id: '', name: '', description: '', permissions: [] }">
            {{ t('Cancel') }}
          </BaseButton>
          <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="createRole">{{ t('Create') }}</BaseButton>
        </div>
      </div>

      <div
        v-for="role in state.roles" :key="role.id"
        class="bg-surface-soft border border-border rounded-xl p-4"
      >
        <header class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1 min-w-0">
            <template v-if="editingId === role.id">
              <input
                v-model="draft.name"
                class="font-semibold bg-surface border border-border rounded px-2 py-1 text-sm w-full mb-1 focus:outline-none focus:border-primary/60"
              />
              <input
                v-model="draft.description"
                :placeholder="t('Description (optional)')"
                class="text-xs text-muted bg-surface border border-border rounded px-2 py-1 w-full focus:outline-none focus:border-primary/60"
              />
            </template>
            <template v-else>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold">{{ role.name }}</h3>
                <span v-if="role.system" class="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                  {{ t('System') }}
                </span>
                <code class="text-[10px] text-muted/60">{{ role.id }}</code>
              </div>
              <p v-if="role.description" class="text-xs text-muted mt-1">{{ role.description }}</p>
            </template>
          </div>

          <div class="flex gap-1 shrink-0" v-if="canWriteRoles">
            <template v-if="editingId === role.id">
              <BaseButton variant="pill" @click="editingId = null">{{ t('Cancel') }}</BaseButton>
              <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" @click="save(role)">{{ t('Save') }}</BaseButton>
            </template>
            <template v-else>
              <BaseButton variant="pill" icon="mdiPencil" :icon-size="11" @click="startEdit(role)">{{ t('Edit') }}</BaseButton>
              <BaseButton
                v-if="!role.system"
                variant="pill"
                icon="mdiDelete"
                :icon-size="11"
                class="text-error! border-error/30! hover:bg-error/10!"
                @click="onDelete(role)"
              >{{ t('Delete') }}</BaseButton>
            </template>
          </div>
        </header>

        <div class="flex flex-wrap gap-1.5">
          <template v-if="editingId === role.id && !role.system">
            <button
              v-for="p in state.permissions" :key="p.id"
              @click="toggleDraftPermission(p.id)"
              :title="p.description ?? ''"
              class="text-[10px] px-2 py-1 rounded-full border transition-colors"
              :class="draft.permissions.includes(p.id)
                ? 'bg-primary text-black/80 border-primary'
                : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
            >{{ p.id }}</button>
          </template>
          <template v-else>
            <span
              v-for="p in role.permissions ?? []" :key="p"
              class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
              :title="state.permissions.find(perm => perm.id === p)?.description ?? ''"
            >{{ p }}</span>
            <span v-if="!role.permissions?.length" class="text-[11px] text-muted/60 italic">
              {{ t('no permissions assigned') }}
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
