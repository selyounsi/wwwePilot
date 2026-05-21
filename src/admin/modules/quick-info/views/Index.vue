<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useToast }  from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminQuickInfo } from '@/admin/modules/quick-info/composables/useAdminQuickInfo.js'
import { downloadJson, pickJsonFile, timestampedFilename } from '@/admin/composables/useJsonIo.js'

const router = useRouter()
const { t }  = useI18n()
const toast  = useToast()
const { has } = usePermissions()
const { state, fetchAll, create, remove, exportAll, importAll } = useAdminQuickInfo()

const canWrite = () => has('admin.quick-info.write')

const createOpen = ref(false)
const draft = ref({ name: '', urlPattern: '' })

onMounted(() => fetchAll())

function openCreate() {
  draft.value = { name: '', urlPattern: '' }
  createOpen.value = true
}

async function submitCreate() {
  if (!draft.value.name.trim() || !draft.value.urlPattern.trim()) return
  try {
    const profile = await create({
      name:       draft.value.name.trim(),
      urlPattern: draft.value.urlPattern.trim(),
    })
    createOpen.value = false
    toast.success(t('Profile created'))
    router.push({ name: 'admin-quick-info-detail', params: { id: profile.id } })
  } catch (e) {
    toast.error(e.message)
  }
}

async function onDelete(profile) {
  if (!confirm(t('Delete profile "{n}"? This also removes its sections and rules.', { n: profile.name }))) return
  try {
    await remove(profile.id)
    toast.success(t('Profile deleted'))
  } catch (e) { toast.error(e.message) }
}

const columns = [
  { key: 'name',       label: 'Name',         minWidth: 200 },
  { key: 'urlPattern', label: 'URL pattern',  minWidth: 280 },
  { key: 'counts',     label: 'Sections / Rules', minWidth: 140, align: 'right' },
  { key: 'enabled',    label: 'Enabled',      minWidth: 90 },
]

function openDetail(profile) {
  router.push({ name: 'admin-quick-info-detail', params: { id: profile.id } })
}

async function doExport() {
  try {
    const data = await exportAll()
    downloadJson(data, timestampedFilename('quick-info'))
    toast.success(t('Export started'))
  } catch (e) { toast.error(e.message) }
}

async function doImport() {
  try {
    const data = await pickJsonFile()
    if (!data) return   // user cancelled
    if (!Array.isArray(data.profiles) || !data.profiles.length) {
      toast.error(t('Invalid file — no profiles found'))
      return
    }
    const replace = confirm(t('Replace all existing profiles? Cancel = merge / append.'))
    const result = await importAll(data, replace ? 'replace' : 'merge')
    toast.success(t('Imported {p} profiles, {s} sections, {r} rules', {
      p: result.profiles, s: result.sections, r: result.rules,
    }))
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Quick-info profiles') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Admin-defined per-URL profiles. Each profile matches a URL via regex and bundles sections of extraction rules that pull text and links from the live DOM.') }}
        </p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap shrink-0">
        <BaseButton
          variant="pill"
          icon="mdiTrayArrowDown"
          :icon-size="13"
          :tooltip="t('Export profiles as JSON')"
          @click="doExport"
        >{{ t('Export') }}</BaseButton>
        <BaseButton
          v-if="canWrite()"
          variant="pill"
          icon="mdiTrayArrowUp"
          :icon-size="13"
          :tooltip="t('Import from JSON file')"
          @click="doImport"
        >{{ t('Import') }}</BaseButton>
        <BaseButton
          v-if="canWrite()"
          variant="pill"
          icon="mdiPlus"
          :icon-size="13"
          class="bg-primary! border-primary! text-black/80!"
          @click="openCreate"
        >{{ t('New profile') }}</BaseButton>
      </div>
    </header>

    <DataTable
      :rows="state.profiles"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openDetail"
      :empty-text="t('No profiles yet. Create your first one above.')"
      min-width="900px"
    >
      <template #cell-name="{ row }">
        <div class="font-medium truncate">{{ row.name }}</div>
        <div v-if="row.description" class="text-[10px] text-muted/70 truncate">{{ row.description }}</div>
      </template>

      <template #cell-urlPattern="{ row }">
        <code class="text-[10px] font-mono text-muted break-all">{{ row.urlPattern }}</code>
      </template>

      <template #cell-counts="{ row }">
        <span class="text-xs">{{ row.sectionCount }} / {{ row.ruleCount }}</span>
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

    <BaseModal :open="createOpen" size="md" :title="t('New profile')" @update:open="createOpen = $event">
      <div class="space-y-3">
        <FormField
          v-model="draft.name"
          :label="t('Display name')"
          :placeholder="t('e.g. IPSI Project Detail')"
        />
        <FormField
          v-model="draft.urlPattern"
          mono
          :label="t('URL pattern (regex)')"
          :placeholder="'^https://example\\.com/path/\\d+$'"
        />
        <p class="text-[10px] text-muted/70">
          {{ t('First profile whose pattern matches the active tab URL wins. After creation you can add sections, rules and visibility filters.') }}
        </p>
      </div>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <BaseButton variant="ghost" @click="createOpen = false">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            class="bg-primary! border-primary! text-black/80!"
            :disabled="!draft.name.trim() || !draft.urlPattern.trim() || state.busy"
            @click="submitCreate"
          >{{ t('Create + edit') }}</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
