<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminQuickLinks } from '@/admin/modules/quick-links/composables/useAdminQuickLinks.js'
import { useAdminRoles }  from '@/admin/modules/roles/composables/useAdminRoles.js'
import { useAdminUsers }  from '@/admin/modules/users/composables/useAdminUsers.js'
import { useAdminGroups } from '@/admin/modules/groups/composables/useAdminGroups.js'

const route   = useRoute()
const router  = useRouter()
const { t }   = useI18n()
const toast   = useToast()
const { has } = usePermissions()
const { state, fetchOne, update, remove } = useAdminQuickLinks()
const { state: rolesState,  fetchAll: fetchRoles }  = useAdminRoles()
const { state: usersState,  fetchAll: fetchUsers }  = useAdminUsers()
const { state: groupsState, fetchAll: fetchGroups } = useAdminGroups()

const canWrite = computed(() => has('admin.quick-links.write'))
const id = computed(() => String(route.params.id ?? ''))

const PAGE_TYPE_OPTIONS = [
  { value: 'cms3',      label: 'CMS3' },
  { value: 'cms4',      label: 'CMS4' },
  { value: 'everpress', label: 'EverPress' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'unknown',   label: 'Unknown' },
]

const draft = ref({
  label: '', description: '', icon: '', urlTemplate: '',
  pageTypes: [], enabled: true,
  roleIds: [], userIds: [], groupIds: [],
})
const dirty = ref(false)
const userSearch = ref('')

async function load() {
  if (!id.value) return
  try {
    const link = await fetchOne(id.value)
    draft.value = {
      label:       link.label,
      description: link.description ?? '',
      icon:        link.icon ?? '',
      urlTemplate: link.urlTemplate,
      pageTypes:   [...(link.pageTypes ?? [])],
      enabled:     link.enabled,
      roleIds:     [...(link.roleIds  ?? [])],
      userIds:     [...(link.userIds  ?? [])],
      groupIds:    [...(link.groupIds ?? [])],
    }
    dirty.value = false
  } catch (e) { toast.error(e.message) }
}

onMounted(() => {
  load()
  if (!rolesState.roles?.length)   fetchRoles()
  if (!usersState.users?.length)   fetchUsers()
  if (!groupsState.groups?.length) fetchGroups()
})
watch(id, load)
watch(draft, () => { dirty.value = true }, { deep: true })

function togglePageType(value) {
  const arr = draft.value.pageTypes
  const i = arr.indexOf(value)
  if (i >= 0) arr.splice(i, 1)
  else        arr.push(value)
}
function toggleRole(roleId)  { const arr = draft.value.roleIds;  const i = arr.indexOf(roleId);  i >= 0 ? arr.splice(i, 1) : arr.push(roleId) }
function toggleUser(userId)  { const arr = draft.value.userIds;  const i = arr.indexOf(userId);  i >= 0 ? arr.splice(i, 1) : arr.push(userId) }
function toggleGroup(groupId){ const arr = draft.value.groupIds; const i = arr.indexOf(groupId); i >= 0 ? arr.splice(i, 1) : arr.push(groupId) }

function userLabel(u) {
  if (!u) return '—'
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email || u.id.slice(0, 8)
}

const filteredUsers = computed(() => {
  const q = userSearch.value.toLowerCase().trim()
  const all = usersState.users ?? []
  const matches = q
    ? all.filter(u =>
        (u.email     ?? '').toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName  ?? '').toLowerCase().includes(q) ||
        (u.name      ?? '').toLowerCase().includes(q),
      )
    : all
  const seen = new Set()
  const out = []
  for (const sid of draft.value.userIds) {
    const u = all.find(x => x.id === sid)
    if (u && !seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  for (const u of matches.slice(0, 50)) {
    if (!seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  return out
})

const previewUrl = computed(() => {
  if (!draft.value.urlTemplate) return ''
  // Static demo expansion so the admin can preview placeholder substitution.
  const ctx = {
    url:       'https://www.example.de/produkte/123',
    host:      'www.example.de',
    domain:    'example.de',
    origin:    'https://www.example.de',
    path:      '/produkte/123',
    counterId: 'R28C51034W50790',
    cms:       draft.value.pageTypes[0] || 'cms4',
  }
  return draft.value.urlTemplate.replace(/<([a-zA-Z][\w-]*)>/g, (m, k) => ctx[k] ?? m)
})

async function save() {
  try {
    await update(id.value, {
      label:       draft.value.label.trim(),
      description: draft.value.description.trim() || null,
      icon:        draft.value.icon.trim() || null,
      urlTemplate: draft.value.urlTemplate.trim(),
      pageTypes:   draft.value.pageTypes,
      enabled:     draft.value.enabled,
      roleIds:     draft.value.roleIds,
      userIds:     draft.value.userIds,
      groupIds:    draft.value.groupIds,
    })
    toast.success(t('Saved'))
    dirty.value = false
  } catch (e) { toast.error(e.message) }
}

async function onDelete() {
  if (!confirm(t('Delete link "{l}"?', { l: draft.value.label }))) return
  try {
    await remove(id.value)
    toast.success(t('Link deleted'))
    router.push({ name: 'admin-quick-links' })
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6 space-y-5 max-w-3xl">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <BaseButton variant="ghost" icon="mdiChevronLeft" @click="router.push({ name: 'admin-quick-links' })">
          {{ t('All links') }}
        </BaseButton>
        <h2 class="text-xl font-bold mt-1.5 truncate">{{ draft.label || t('Quick link') }}</h2>
      </div>
      <div class="flex gap-2 shrink-0">
        <BaseButton v-if="canWrite" variant="icon-error" icon="mdiDelete" :icon-size="16" :tooltip="t('Delete')" @click="onDelete" />
        <BaseButton
          v-if="canWrite"
          class="bg-primary! border-primary! text-black/80!"
          :disabled="!dirty || state.busy"
          @click="save"
        >{{ dirty ? t('Save') : t('Saved') }}</BaseButton>
      </div>
    </header>

    <BaseCard :title="t('Basics')">
      <div class="space-y-3">
        <FormField v-model="draft.label" :label="t('Label')" :disabled="!canWrite" />
        <FormField v-model="draft.description" :label="t('Description')" :placeholder="t('Optional — shown under the label')" :disabled="!canWrite" />
        <FormField v-model="draft.icon" mono :label="t('Icon (mdi name)')" placeholder="mdiOpenInNew" :disabled="!canWrite" />
        <FormField v-model="draft.urlTemplate" mono :label="t('URL template')" placeholder="https://cms4.euroweb.de/website/<domain>" :disabled="!canWrite" />
        <div v-if="previewUrl" class="text-[10px] text-muted/80">
          <span class="uppercase tracking-wide text-muted/60">{{ t('Preview') }}:</span>
          <code class="font-mono ml-1 break-all text-muted">{{ previewUrl }}</code>
        </div>
        <div class="flex items-center gap-2">
          <CheckboxField v-model="draft.enabled" :label="t('Enabled')" :disabled="!canWrite" />
        </div>
      </div>
    </BaseCard>

    <BaseCard :title="t('Page types')">
      <p class="text-[11px] text-muted/70 mb-2">{{ t('Pick the CMS types this link should appear for. Empty = shown for every detected type (including Unknown).') }}</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="opt in PAGE_TYPE_OPTIONS"
          :key="opt.value"
          type="button"
          :disabled="!canWrite"
          class="px-2 py-0.5 rounded-md border text-xs disabled:opacity-50"
          :class="draft.pageTypes.includes(opt.value)
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'bg-muted/10 border-border text-muted hover:bg-muted/20'"
          @click="togglePageType(opt.value)"
        >{{ t(opt.label) }}</button>
      </div>
    </BaseCard>

    <BaseCard :title="t('Visibility')">
      <p class="text-[11px] text-muted/70 mb-3">{{ t('OR-unioned across the three dimensions. Empty everywhere = visible to all authenticated users.') }}</p>

      <div class="space-y-3">
        <div>
          <div class="text-xs font-medium mb-1.5">{{ t('Roles') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="role in rolesState.roles ?? []"
              :key="role.id"
              type="button"
              :disabled="!canWrite"
              class="px-2 py-0.5 rounded-md border text-xs disabled:opacity-50"
              :class="draft.roleIds.includes(role.id)
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-muted/10 border-border text-muted hover:bg-muted/20'"
              @click="toggleRole(role.id)"
            >{{ role.name }}</button>
          </div>
        </div>

        <div>
          <div class="text-xs font-medium mb-1.5">{{ t('Groups') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="group in groupsState.groups ?? []"
              :key="group.id"
              type="button"
              :disabled="!canWrite"
              class="px-2 py-0.5 rounded-md border text-xs disabled:opacity-50"
              :class="draft.groupIds.includes(group.id)
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-muted/10 border-border text-muted hover:bg-muted/20'"
              @click="toggleGroup(group.id)"
            >{{ group.name }}</button>
          </div>
        </div>

        <div>
          <div class="text-xs font-medium mb-1.5">{{ t('Users') }}</div>
          <FormField v-model="userSearch" :placeholder="t('Filter users…')" class="mb-2" />
          <div class="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
            <button
              v-for="u in filteredUsers"
              :key="u.id"
              type="button"
              :disabled="!canWrite"
              class="px-2 py-0.5 rounded-md border text-xs disabled:opacity-50"
              :class="draft.userIds.includes(u.id)
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-muted/10 border-border text-muted hover:bg-muted/20'"
              @click="toggleUser(u.id)"
            >{{ userLabel(u) }}</button>
          </div>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
