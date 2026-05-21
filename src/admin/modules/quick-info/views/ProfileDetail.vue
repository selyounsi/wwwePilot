<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminQuickInfo } from '@/admin/modules/quick-info/composables/useAdminQuickInfo.js'
import { useAdminRoles }  from '@/admin/modules/roles/composables/useAdminRoles.js'
import { useAdminUsers }  from '@/admin/modules/users/composables/useAdminUsers.js'
import { useAdminGroups } from '@/admin/modules/groups/composables/useAdminGroups.js'

const route   = useRoute()
const router  = useRouter()
const { t }   = useI18n()
const toast   = useToast()
const { has } = usePermissions()
const {
  state, fetchOne, update, remove,
  addSection, updateSection, removeSection,
  addRule, updateRule, removeRule,
} = useAdminQuickInfo()
const { state: rolesState,  fetchAll: fetchRoles }  = useAdminRoles()
const { state: usersState,  fetchAll: fetchUsers }  = useAdminUsers()
const { state: groupsState, fetchAll: fetchGroups } = useAdminGroups()

const canWrite = computed(() => has('admin.quick-info.write'))
const id = computed(() => String(route.params.id ?? ''))

const draft = ref({
  name: '', description: '', urlPattern: '', enabled: true,
  roleIds: [], userIds: [], groupIds: [],
})
const dirty = ref(false)
const userSearch = ref('')

async function load() {
  if (!id.value) return
  try {
    const { profile } = await fetchOne(id.value)
    draft.value = {
      name:        profile.name,
      description: profile.description ?? '',
      urlPattern:  profile.urlPattern,
      enabled:     profile.enabled,
      roleIds:     [...(profile.roleIds  ?? [])],
      userIds:     [...(profile.userIds  ?? [])],
      groupIds:    [...(profile.groupIds ?? [])],
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

function toggleRole(roleId) {
  const i = draft.value.roleIds.indexOf(roleId)
  if (i >= 0) draft.value.roleIds.splice(i, 1)
  else        draft.value.roleIds.push(roleId)
}
function toggleUser(userId) {
  const i = draft.value.userIds.indexOf(userId)
  if (i >= 0) draft.value.userIds.splice(i, 1)
  else        draft.value.userIds.push(userId)
}
function toggleGroup(groupId) {
  const i = draft.value.groupIds.indexOf(groupId)
  if (i >= 0) draft.value.groupIds.splice(i, 1)
  else        draft.value.groupIds.push(groupId)
}

function userLabel(u) {
  if (!u) return '—'
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email || u.id.slice(0, 8)
}

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
  const seen = new Set()
  const out = []
  for (const sid of draft.value.userIds) {
    const u = all.find(x => x.id === sid)
    if (u && !seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  for (const u of matches) {
    if (!seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  return { rows: out.slice(0, 50), total: out.length, selectedSet }
})

async function saveProfile() {
  try {
    await update(id.value, {
      name:        draft.value.name,
      description: draft.value.description || null,
      urlPattern:  draft.value.urlPattern,
      enabled:     draft.value.enabled,
      roleIds:     draft.value.roleIds,
      userIds:     draft.value.userIds,
      groupIds:    draft.value.groupIds,
    })
    toast.success(t('Profile saved'))
    dirty.value = false
  } catch (e) { toast.error(e.message) }
}

async function onDelete() {
  if (!confirm(t('Delete profile "{n}"? This also removes its sections and rules.', { n: draft.value.name }))) return
  try {
    await remove(id.value)
    toast.success(t('Profile deleted'))
    router.push({ name: 'admin-quick-info' })
  } catch (e) { toast.error(e.message) }
}

const sectionFormOpen = ref(false)
const sectionDraft    = ref({ label: '' })

function openSectionCreate() {
  sectionDraft.value = { label: '' }
  sectionFormOpen.value = true
}

async function submitSection() {
  if (!sectionDraft.value.label.trim()) return
  try {
    await addSection(id.value, { label: sectionDraft.value.label.trim() })
    sectionFormOpen.value = false
    toast.success(t('Section added'))
  } catch (e) { toast.error(e.message) }
}

async function renameSection(section) {
  const next = prompt(t('New label'), section.label)
  if (next == null || !next.trim() || next === section.label) return
  try { await updateSection(id.value, section.id, { label: next.trim() }) }
  catch (e) { toast.error(e.message) }
}

async function toggleSection(section) {
  try { await updateSection(id.value, section.id, { enabled: !section.enabled }) }
  catch (e) { toast.error(e.message) }
}

async function deleteSection(section) {
  if (!confirm(t('Delete section "{n}" and all its rules?', { n: section.label }))) return
  try { await removeSection(id.value, section.id) }
  catch (e) { toast.error(e.message) }
}

const ruleFormOpen    = ref(false)
const ruleFormSection = ref(null)
const ruleEditingId   = ref(null)
const ruleDraft       = ref(null)

function blankRule() {
  return {
    title:       '',
    description: '',
    kind:        'text',
    selector:    '',
    pattern:     '',
    multiple:    false,
    actions:     ['copy'],
    enabled:     true,
    roleIds:     [],
    userIds:     [],
    groupIds:    [],
  }
}

function openRuleCreate(section) {
  ruleFormSection.value = section
  ruleDraft.value       = blankRule()
  ruleEditingId.value   = null
  ruleFormOpen.value    = true
}

function openRuleEdit(section, rule) {
  ruleFormSection.value = section
  ruleDraft.value = {
    title:       rule.title,
    description: rule.description ?? '',
    kind:        rule.kind,
    selector:    rule.selector,
    pattern:     rule.pattern ?? '',
    multiple:    rule.multiple,
    actions:     [...(rule.actions ?? [])],
    enabled:     rule.enabled ?? true,
    roleIds:     [...(rule.roleIds  ?? [])],
    userIds:     [...(rule.userIds  ?? [])],
    groupIds:    [...(rule.groupIds ?? [])],
  }
  ruleEditingId.value = rule.id
  ruleFormOpen.value  = true
}

function toggleRuleEnabled(rule) {
  updateRule(id.value, rule.id, { enabled: !rule.enabled }).catch(e => toast.error(e.message))
}

function toggleRuleArray(field, value) {
  const arr = ruleDraft.value[field]
  const i = arr.indexOf(value)
  if (i >= 0) arr.splice(i, 1)
  else        arr.push(value)
}

function toggleAction(name) {
  const i = ruleDraft.value.actions.indexOf(name)
  if (i >= 0) ruleDraft.value.actions.splice(i, 1)
  else        ruleDraft.value.actions.push(name)
}

async function submitRule() {
  if (!ruleDraft.value.title.trim() || !ruleDraft.value.selector.trim()) return
  const payload = {
    title:       ruleDraft.value.title.trim(),
    description: ruleDraft.value.description.trim() || null,
    kind:        ruleDraft.value.kind,
    selector:    ruleDraft.value.selector.trim(),
    pattern:     ruleDraft.value.pattern.trim() || null,
    multiple:    !!ruleDraft.value.multiple,
    actions:     ruleDraft.value.actions,
    enabled:     !!ruleDraft.value.enabled,
    roleIds:     ruleDraft.value.roleIds,
    userIds:     ruleDraft.value.userIds,
    groupIds:    ruleDraft.value.groupIds,
  }
  try {
    if (ruleEditingId.value) {
      await updateRule(id.value, ruleEditingId.value, payload)
      toast.success(t('Rule saved'))
    } else {
      await addRule(id.value, ruleFormSection.value.id, payload)
      toast.success(t('Rule added'))
    }
    ruleFormOpen.value = false
  } catch (e) { toast.error(e.message) }
}

async function deleteRule(rule) {
  if (!confirm(t('Delete rule "{n}"?', { n: rule.title }))) return
  try { await removeRule(id.value, rule.id) }
  catch (e) { toast.error(e.message) }
}

const sections = computed(() => state.current?.sections ?? [])

const KIND_OPTIONS = [
  { value: 'text', label: t('Text') },
  { value: 'link', label: t('Link') },
]
const ACTION_OPTIONS = [
  { value: 'copy', label: t('Copy') },
  { value: 'open', label: t('Open') },
  { value: 'chat', label: t('Send to chat') },
]
</script>

<template>
  <div class="p-6 space-y-6">
    <header class="flex items-center gap-3 flex-wrap">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.push({ name: 'admin-quick-info' })">
        {{ t('Back') }}
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate">{{ draft.name || t('Profile') }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ draft.urlPattern }}</p>
      </div>
      <BaseButton
        v-if="canWrite"
        class="bg-primary! border-primary! text-black/80!"
        :disabled="!dirty || state.busy"
        @click="saveProfile"
      >{{ dirty ? t('Save changes') : t('Saved') }}</BaseButton>
      <BaseButton
        v-if="canWrite"
        variant="ghost"
        icon="mdiDelete"
        :icon-size="14"
        @click="onDelete"
      >{{ t('Delete profile') }}</BaseButton>
    </header>

    <div v-if="!state.current" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <BaseCard :title="t('Profile')" divided>
        <div class="space-y-3">
          <FormField v-model="draft.name" :label="t('Display name')" :disabled="!canWrite" />
          <FormField
            v-model="draft.urlPattern"
            mono
            :label="t('URL pattern (regex)')"
            :placeholder="'^https://example\\.com/path/\\d+$'"
            :helper-text="t('First profile whose pattern matches the active tab URL wins.')"
            :disabled="!canWrite"
          />
          <TextareaField
            v-model="draft.description"
            :rows="2"
            :label="t('Description (optional)')"
            :disabled="!canWrite"
          />
          <CheckboxField
            v-model="draft.enabled"
            :label="t('Enabled — appears in the sidebar when its URL pattern matches')"
            :disabled="!canWrite"
          />
        </div>
      </BaseCard>

      <BaseCard
        :title="t('Visible to')"
        :subtitle="t('Empty = everyone. Combine roles, groups and individual users — anyone matching any condition can see the profile.')"
        divided
      >
        <div class="space-y-3">
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1.5">{{ t('Roles') }}</div>
            <div v-if="rolesState.roles?.length" class="flex flex-wrap gap-1.5">
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
            <div v-if="groupsState.groups?.length" class="flex flex-wrap gap-1.5">
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
          </div>
        </div>

        <p v-if="!draft.roleIds.length && !draft.userIds.length && !draft.groupIds.length" class="mt-3 text-[10px] text-muted">
          <Icon name="mdiInformationOutline" :size="11" class="inline -mt-0.5" />
          {{ t('Visible to every authenticated user.') }}
        </p>
      </BaseCard>

      <BaseCard
        v-for="section in sections"
        :key="section.id"
        :title="section.label"
        divided
        class="lg:col-span-2"
        :class="!section.enabled && 'opacity-60'"
      >
        <template #header>
          <div class="flex items-center gap-2 min-w-0">
            <h3 class="font-semibold text-sm truncate">{{ section.label }}</h3>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              :class="section.enabled
                ? 'bg-success/15 text-success'
                : 'bg-muted/15 text-muted'"
            >{{ section.enabled ? t('Active') : t('Disabled') }}</span>
            <span class="text-[11px] text-muted/70 truncate">{{ t('{n} rule(s)', { n: section.rules.length }) }}</span>
          </div>
        </template>
        <template #actions>
          <BaseButton
            v-if="canWrite"
            variant="icon"
            :icon="section.enabled ? 'mdiToggleSwitch' : 'mdiToggleSwitchOffOutline'"
            :icon-size="14"
            :tooltip="section.enabled ? t('Disable section') : t('Enable section')"
            @click="toggleSection(section)"
          />
          <BaseButton v-if="canWrite" variant="icon" icon="mdiPencil" :icon-size="13" :tooltip="t('Rename')" @click="renameSection(section)" />
          <BaseButton v-if="canWrite" variant="icon-error" icon="mdiDelete" :icon-size="13" :tooltip="t('Delete section')" @click="deleteSection(section)" />
          <BaseButton v-if="canWrite" variant="pill" icon="mdiPlus" :icon-size="11" @click="openRuleCreate(section)">
            {{ t('Add rule') }}
          </BaseButton>
        </template>

        <ItemList
          :items="section.rules"
          :empty-text="t('No rules in this section yet.')"
        >
          <template #item="{ item: rule }">
            <ItemListRow :class="!rule.enabled && 'opacity-50'">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-sm font-medium truncate">{{ rule.title }}</span>
                  <span v-if="!rule.enabled" class="text-[10px] px-1.5 py-0.5 rounded bg-muted/15 text-muted">{{ t('Disabled') }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light">{{ rule.kind }}</span>
                  <span v-if="rule.multiple" class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light">multiple</span>
                  <span
                    v-for="a in rule.actions" :key="a"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary"
                  >{{ a }}</span>
                  <span
                    v-if="rule.roleIds?.length || rule.userIds?.length || rule.groupIds?.length"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-alert/15 text-alert inline-flex items-center gap-1"
                    :title="t('Restricted to specific roles / groups / users')"
                  >
                    <Icon name="mdiLockOutline" :size="10" />
                    {{ t('restricted') }}
                  </span>
                </div>
                <code class="text-[10px] font-mono text-muted/70 break-all block mt-0.5">{{ rule.selector }}</code>
                <code v-if="rule.pattern" class="text-[10px] font-mono text-muted/60 break-all block">
                  {{ t('pattern') }}: {{ rule.pattern }}
                </code>
                <p v-if="rule.description" class="text-[10px] text-muted/60 mt-0.5">{{ rule.description }}</p>
              </div>
              <template v-if="canWrite">
                <BaseButton
                  variant="icon"
                  :icon="rule.enabled ? 'mdiToggleSwitch' : 'mdiToggleSwitchOffOutline'"
                  :icon-size="14"
                  :tooltip="rule.enabled ? t('Disable rule') : t('Enable rule')"
                  @click="toggleRuleEnabled(rule)"
                />
                <BaseButton variant="icon" icon="mdiPencil" :icon-size="13" :tooltip="t('Edit')" @click="openRuleEdit(section, rule)" />
                <BaseButton variant="icon-error" icon="mdiDelete" :icon-size="13" :tooltip="t('Delete')" @click="deleteRule(rule)" />
              </template>
            </ItemListRow>
          </template>
        </ItemList>
      </BaseCard>

      <BaseCard
        v-if="canWrite"
        :title="t('Add section')"
        divided
        class="lg:col-span-2"
      >
        <div class="flex items-end gap-2 flex-wrap">
          <FormField
            v-model="sectionDraft.label"
            :label="t('Section label')"
            :placeholder="t('e.g. Customer data')"
            class="flex-1 min-w-50"
            @keydown.enter.prevent="submitSection"
          />
          <BaseButton
            class="bg-primary! border-primary! text-black/80!"
            :disabled="!sectionDraft.label.trim() || state.busy"
            @click="submitSection"
          >{{ t('Add section') }}</BaseButton>
        </div>
      </BaseCard>
    </div>

    <BaseModal :open="ruleFormOpen" size="lg" :title="ruleEditingId ? t('Edit rule') : t('Add rule')" @update:open="ruleFormOpen = $event">
      <div v-if="ruleDraft" class="space-y-3">
        <FormField
          v-model="ruleDraft.title"
          :label="t('Title')"
          :placeholder="t('e.g. Contract owner email')"
        />
        <TextareaField
          v-model="ruleDraft.description"
          :label="t('Description / helper text (optional)')"
          :rows="2"
        />
        <SelectField
          v-model="ruleDraft.kind"
          :label="t('Kind')"
          :options="KIND_OPTIONS"
        />
        <FormField
          v-model="ruleDraft.selector"
          mono
          :label="t('CSS selector')"
          :placeholder="'.contract-owner [href^=\'mailto:\']'"
          :helper-text="t('Tip: test the selector via DevTools on the target page before saving.')"
        />
        <FormField
          v-model="ruleDraft.pattern"
          mono
          :label="t('Pattern (optional regex post-filter)')"
          :placeholder="'mailto:(.+)'"
          :helper-text="t('When the regex has a capture group, the group is returned. No match = empty value.')"
        />
        <CheckboxField
          v-model="ruleDraft.multiple"
          :label="t('Match multiple (returns list of values)')"
        />
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1.5">{{ t('Actions') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="a in ACTION_OPTIONS" :key="a.value"
              type="button"
              class="text-[11px] px-2.5 py-1 rounded-full border transition-colors"
              :class="ruleDraft.actions.includes(a.value)
                ? 'bg-primary text-black/80 border-primary'
                : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
              @click="toggleAction(a.value)"
            >{{ a.label }}</button>
          </div>
        </div>

        <CheckboxField
          v-model="ruleDraft.enabled"
          :label="t('Enabled — appears in the sidebar')"
        />

        <div class="pt-2 border-t border-border/40">
          <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1.5">{{ t('Restrict visibility (optional)') }}</div>
          <p class="text-[10px] text-muted/60 mb-2">
            {{ t('Empty = inherit profile visibility. Otherwise this rule is hidden unless the user matches at least one role / group / user listed here.') }}
          </p>

          <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1">{{ t('Roles') }}</div>
          <div v-if="rolesState.roles?.length" class="flex flex-wrap gap-1.5 mb-3">
            <button
              v-for="r in rolesState.roles" :key="r.id"
              type="button"
              class="text-[11px] px-2.5 py-1 rounded-full border transition-colors"
              :class="ruleDraft.roleIds.includes(r.id)
                ? 'bg-primary text-black/80 border-primary'
                : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
              @click="toggleRuleArray('roleIds', r.id)"
            >{{ r.name }}</button>
          </div>

          <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1">{{ t('Groups') }}</div>
          <div v-if="groupsState.groups?.length" class="flex flex-wrap gap-1.5 mb-3">
            <button
              v-for="g in groupsState.groups" :key="g.id"
              type="button"
              class="text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1 transition-colors"
              :class="ruleDraft.groupIds.includes(g.id)
                ? 'bg-primary text-black/80 border-primary'
                : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
              @click="toggleRuleArray('groupIds', g.id)"
            >
              <Icon name="mdiAccountGroupOutline" :size="10" />
              <span>{{ g.name }}</span>
            </button>
          </div>
          <p v-else class="text-[11px] text-muted/60 italic mb-3">{{ t('No groups defined yet.') }}</p>

          <div class="text-[10px] uppercase tracking-wide text-muted/70 mb-1">{{ t('Individual users') }}</div>
          <div class="max-h-40 overflow-y-auto border border-border rounded bg-surface divide-y divide-border/30">
            <label
              v-for="u in usersState.users ?? []" :key="u.id"
              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-surface-soft-hover transition-colors text-[11px]"
            >
              <input
                type="checkbox"
                :checked="ruleDraft.userIds.includes(u.id)"
                class="accent-primary"
                @change="toggleRuleArray('userIds', u.id)"
              />
              <span class="truncate">{{ userLabel(u) }}</span>
              <span v-if="u.email" class="text-muted/60 truncate ml-auto">{{ u.email }}</span>
            </label>
            <p v-if="!usersState.users?.length" class="px-2 py-2 text-muted/60 italic">{{ t('No users loaded.') }}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <BaseButton variant="ghost" @click="ruleFormOpen = false">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            class="bg-primary! border-primary! text-black/80!"
            :disabled="!ruleDraft?.title.trim() || !ruleDraft?.selector.trim() || state.busy"
            @click="submitRule"
          >{{ ruleEditingId ? t('Save') : t('Add') }}</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
