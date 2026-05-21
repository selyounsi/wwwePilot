<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useToast }  from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminQuickLinks } from '@/admin/modules/quick-links/composables/useAdminQuickLinks.js'
import { downloadJson, pickJsonFile, timestampedFilename } from '@/admin/composables/useJsonIo.js'

const router = useRouter()
const { t }  = useI18n()
const toast  = useToast()
const { has } = usePermissions()
const { state, fetchAll, create, remove, exportAll, importAll } = useAdminQuickLinks()

const canWrite = () => has('admin.quick-links.write')

const createOpen = ref(false)
const draft = ref({ label: '', urlTemplate: '', pageTypes: [] })

onMounted(() => fetchAll())

function openCreate() {
  draft.value = { label: '', urlTemplate: '', pageTypes: [] }
  createOpen.value = true
}

async function submitCreate() {
  if (!draft.value.label.trim() || !draft.value.urlTemplate.trim()) return
  try {
    const link = await create({
      label:       draft.value.label.trim(),
      urlTemplate: draft.value.urlTemplate.trim(),
      pageTypes:   draft.value.pageTypes,
    })
    createOpen.value = false
    toast.success(t('Link created'))
    router.push({ name: 'admin-quick-links-detail', params: { id: link.id } })
  } catch (e) {
    toast.error(e.message)
  }
}

async function onDelete(link) {
  if (!confirm(t('Delete link "{l}"?', { l: link.label }))) return
  try {
    await remove(link.id)
    toast.success(t('Link deleted'))
  } catch (e) { toast.error(e.message) }
}

const columns = [
  { key: 'label',       label: 'Label',     minWidth: 180 },
  { key: 'urlTemplate', label: 'URL template', minWidth: 280 },
  { key: 'pageTypes',   label: 'Page types', minWidth: 160 },
  { key: 'enabled',     label: 'Enabled',   minWidth: 90 },
]

const PAGE_TYPE_OPTIONS = [
  { value: 'cms3',      label: 'CMS3' },
  { value: 'cms4',      label: 'CMS4' },
  { value: 'everpress', label: 'EverPress' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'unknown',   label: 'Unknown' },
]

function togglePageType(value) {
  const arr = draft.value.pageTypes
  const idx = arr.indexOf(value)
  if (idx === -1) arr.push(value)
  else            arr.splice(idx, 1)
}

function openDetail(link) {
  router.push({ name: 'admin-quick-links-detail', params: { id: link.id } })
}

async function doExport() {
  try {
    const data = await exportAll()
    downloadJson(data, timestampedFilename('quick-links'))
    toast.success(t('Export started'))
  } catch (e) { toast.error(e.message) }
}

async function doImport() {
  try {
    const data = await pickJsonFile()
    if (!data) return
    if (!Array.isArray(data.links) || !data.links.length) {
      toast.error(t('Invalid file — no links found'))
      return
    }
    const replace = confirm(t('Replace all existing links? Cancel = merge / append.'))
    const result = await importAll(data, replace ? 'replace' : 'merge')
    toast.success(t('Imported {n} links', { n: result.links }))
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-xl font-bold">{{ t('Quick links') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Admin-defined URL shortcuts shown in the Quick-Page-Info sidebar. Each link is filtered by the detected CMS type of the active tab and may use placeholders like <domain>, <host>, <origin>, <path>, <url>, <counterId>.') }}
        </p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap shrink-0">
        <BaseButton
          variant="pill"
          icon="mdiTrayArrowDown"
          :icon-size="13"
          :tooltip="t('Export links as JSON')"
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
        >{{ t('New link') }}</BaseButton>
      </div>
    </header>

    <DataTable
      :rows="state.links"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :on-row-click="openDetail"
      :empty-text="t('No quick-links yet. Create your first one above.')"
      min-width="900px"
    >
      <template #cell-label="{ row }">
        <div class="flex items-center gap-2">
          <Icon v-if="row.icon" :name="row.icon" :size="14" class="text-primary shrink-0" />
          <div class="min-w-0">
            <div class="font-medium truncate">{{ row.label }}</div>
            <div v-if="row.description" class="text-[10px] text-muted/70 truncate">{{ row.description }}</div>
          </div>
        </div>
      </template>

      <template #cell-urlTemplate="{ row }">
        <code class="text-[10px] font-mono text-muted break-all">{{ row.urlTemplate }}</code>
      </template>

      <template #cell-pageTypes="{ row }">
        <div v-if="row.pageTypes.length" class="flex flex-wrap gap-1">
          <CellBadge v-for="pt in row.pageTypes" :key="pt" :value="pt" variant="neutral" />
        </div>
        <span v-else class="text-[10px] text-muted/60 italic">{{ t('any') }}</span>
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

    <BaseModal :open="createOpen" size="md" :title="t('New quick link')" @update:open="createOpen = $event">
      <div class="space-y-3">
        <FormField
          v-model="draft.label"
          :label="t('Label')"
          :placeholder="t('e.g. CMS4 Backend')"
        />
        <FormField
          v-model="draft.urlTemplate"
          mono
          :label="t('URL template')"
          placeholder="https://cms4.euroweb.de/website/<domain>"
        />
        <div>
          <div class="text-xs font-medium mb-1.5">{{ t('Page types (none = all)') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in PAGE_TYPE_OPTIONS"
              :key="opt.value"
              type="button"
              class="px-2 py-0.5 rounded-md border text-xs"
              :class="draft.pageTypes.includes(opt.value)
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-muted/10 border-border text-muted hover:bg-muted/20'"
              @click="togglePageType(opt.value)"
            >{{ t(opt.label) }}</button>
          </div>
        </div>
        <p class="text-[10px] text-muted/70">
          {{ t('Placeholders: <domain>, <host>, <origin>, <path>, <url>, <counterId>, <cms>. After creation you can edit description, icon, position and visibility.') }}
        </p>
      </div>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <BaseButton variant="ghost" @click="createOpen = false">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            class="bg-primary! border-primary! text-black/80!"
            :disabled="!draft.label.trim() || !draft.urlTemplate.trim() || state.busy"
            @click="submitCreate"
          >{{ t('Create + edit') }}</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
