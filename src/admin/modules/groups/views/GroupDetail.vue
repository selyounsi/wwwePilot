<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminGroups } from '@/admin/modules/groups/composables/useAdminGroups.js'
import { useAdminUsers } from '@/admin/modules/users/composables/useAdminUsers.js'

const route   = useRoute()
const router  = useRouter()
const { t }   = useI18n()
const toast   = useToast()
const { has } = usePermissions()
const { state, fetchOne, update, setMembers } = useAdminGroups()
const { state: usersState, fetchAll: fetchUsers } = useAdminUsers()

const canWrite = computed(() => has('admin.groups.write'))

const id = computed(() => String(route.params.id ?? ''))

const draft = ref({ name: '', description: '' })
const memberIds = ref(new Set())
const userSearch = ref('')
const dirty = ref(false)

async function load() {
  if (!id.value) return
  try {
    const { group, members } = await fetchOne(id.value)
    draft.value = {
      name:        group.name,
      description: group.description ?? '',
    }
    memberIds.value = new Set((members ?? []).map(m => m.id))
    dirty.value = false
  } catch (e) {
    toast.error(e.message)
  }
}

onMounted(() => {
  load()
  if (!usersState.users.length) fetchUsers()
})
watch(id, load)
watch(draft, () => { dirty.value = true }, { deep: true })

function toggleMember(userId) {
  if (memberIds.value.has(userId)) memberIds.value.delete(userId)
  else                              memberIds.value.add(userId)
  memberIds.value = new Set(memberIds.value)
  dirty.value = true
}

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
  // selected first
  for (const uid of memberIds.value) {
    const u = all.find(x => x.id === uid)
    if (u && !seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  for (const u of matches) {
    if (!seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  return { rows: out.slice(0, 80), total: out.length }
})

async function save() {
  try {
    await update(id.value, {
      name:        draft.value.name,
      description: draft.value.description || null,
    })
    await setMembers(id.value, [...memberIds.value])
    dirty.value = false
    toast.success(t('Group saved'))
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <header class="flex items-center gap-3 flex-wrap">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.push({ name: 'admin-groups' })">
        {{ t('Back') }}
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate">{{ draft.name || t('Group') }}</h2>
        <p class="text-[11px] text-muted font-mono truncate">{{ id }}</p>
      </div>
      <BaseButton
        v-if="canWrite"
        class="bg-primary! border-primary! text-black/80!"
        :disabled="!dirty || state.busy"
        @click="save"
      >{{ dirty ? t('Save changes') : t('Saved') }}</BaseButton>
    </header>

    <div v-if="!state.current" class="flex items-center justify-center py-12"><LoadingSpinner /></div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <BaseCard :title="t('Group')" divided class="lg:col-span-1">
        <div class="space-y-3">
          <FormField v-model="draft.name" :label="t('Display name')" :disabled="!canWrite" />
          <TextareaField v-model="draft.description" :rows="3" :label="t('Description')" :disabled="!canWrite" />
          <div class="text-[10px] text-muted/60">
            <Icon name="mdiInformationOutline" :size="11" class="inline -mt-0.5" />
            {{ t('Groups carry no permissions. They\'re just a way to bundle users so visibility rules can target them.') }}
          </div>
        </div>
      </BaseCard>

      <BaseCard :title="t('Members')" :subtitle="t('{n} of {total} users selected', { n: memberIds.size, total: usersState.users.length })" divided class="lg:col-span-2">
        <FormField
          v-model="userSearch"
          dense
          prefix-icon="mdiMagnify"
          :placeholder="t('Search by email or name…')"
          :disabled="!canWrite"
        />
        <div class="mt-2 max-h-96 overflow-y-auto border border-border rounded-lg bg-surface divide-y divide-border/30">
          <label
            v-for="u in filteredUsers.rows" :key="u.id"
            class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-soft-hover transition-colors"
            :class="memberIds.has(u.id) && 'bg-primary/5'"
          >
            <input
              type="checkbox"
              :checked="memberIds.has(u.id)"
              :disabled="!canWrite"
              class="accent-primary"
              @change="toggleMember(u.id)"
            />
            <UserAvatar :user="u" :size="22" />
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
      </BaseCard>
    </div>
  </div>
</template>
