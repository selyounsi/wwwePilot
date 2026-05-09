<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { useExtensionVersion } from '@/composables/useExtensionVersion.js'
import { useExtensionPath } from '@/composables/useExtensionPath.js'
import { API } from '@/config/api.js'
import { useAuth } from '@/composables/auth/useAuth.js'

const { t } = useI18n()
const toast = useToast()
const { state: versionState, hasUpdate, refresh: refreshVersion, compareVersions } = useExtensionVersion()
const { state: pathState, hasPath, setPath, clear: clearPath } = useExtensionPath()
const { state: authState } = useAuth()

const method      = ref(hasPath.value ? 'auto' : 'manual')
const downloadId  = ref(null)
const downloading = ref(false)
const step        = ref(1)
const editingPath = ref(false)
const pathDraft   = ref('')
const platformOs  = ref('win')

chrome.runtime.getPlatformInfo?.().then(info => { platformOs.value = info?.os || 'win' }).catch(() => {})

const isMac = computed(() => platformOs.value === 'mac' || platformOs.value === 'linux')
const scriptName = computed(() => isMac.value ? 'update.sh' : 'update.bat')

watch(method, () => { step.value = 1 })
watch(hasPath, (v) => { if (!v && method.value === 'auto') method.value = 'manual' })

function startEditingPath() {
  pathDraft.value = pathState.path
  editingPath.value = true
}
function savePath() {
  setPath(pathDraft.value)
  editingPath.value = false
  toast.success(t('Path saved'))
}
function cancelPathEdit() {
  editingPath.value = false
}

function watchDownloadComplete(id) {
  const handler = (delta) => {
    if (delta.id !== id) return
    if (delta.state?.current === 'complete') {
      try { chrome.downloads.show(id) } catch {}
      step.value = 2
      chrome.downloads.onChanged.removeListener(handler)
    } else if (delta.state?.current === 'interrupted') {
      toast.error(t('Download failed'))
      chrome.downloads.onChanged.removeListener(handler)
    }
  }
  chrome.downloads.onChanged.addListener(handler)
  onBeforeUnmount(() => chrome.downloads.onChanged.removeListener(handler))
}

async function downloadUpdate() {
  if (!versionState.latest) return
  downloading.value = true
  try {
    const url = `${API.version.url}/download/${versionState.latest}`
    const id  = await chrome.downloads.download({
      url,
      filename: `${versionState.latest}.zip`,
      saveAs:   false,
      headers:  authState.accessToken
        ? [{ name: 'Authorization', value: `Bearer ${authState.accessToken}` }]
        : undefined,
    })
    downloadId.value = id
    watchDownloadComplete(id)
  } catch (e) {
    toast.error(e.message || t('Download failed'))
  } finally {
    downloading.value = false
  }
}

async function copyExtensionPath() {
  if (!hasPath.value) return
  try {
    await navigator.clipboard.writeText(pathState.path)
    toast.success(t('Path copied to clipboard — paste in Win+R'))
  } catch {
    toast.error(t('Could not copy'))
    return
  }
  step.value = 3
}

async function copyUpdateScriptPath() {
  if (!hasPath.value) return
  const sep = pathState.path.includes('/') && !pathState.path.includes('\\') ? '/' : '\\'
  const trimmed = pathState.path.replace(/[\\/]+$/, '')
  const fullPath = `${trimmed}${sep}${scriptName.value}`
  const clipboardText = isMac.value ? `bash "${fullPath}"` : fullPath
  try {
    await navigator.clipboard.writeText(clipboardText)
    toast.success(isMac.value
      ? t('Command copied — paste in Terminal + Enter')
      : t('Script path copied — paste in Win+R'))
  } catch {
    toast.error(t('Could not copy'))
    return
  }
  step.value = 2
}

function showInDownloads() {
  if (downloadId.value == null) return
  try { chrome.downloads.show(downloadId.value) } catch {}
  step.value = 3
}

function reloadExtension() {
  chrome.runtime.reload()
}

function openExtensionsPage() {
  chrome.tabs.create({ url: 'chrome://extensions/', active: true })
}

async function downloadVersion(version) {
  try {
    await chrome.downloads.download({
      url:      `${API.version.url}/download/${version}`,
      filename: `${version}.zip`,
      saveAs:   false,
      headers:  authState.accessToken
        ? [{ name: 'Authorization', value: `Bearer ${authState.accessToken}` }]
        : undefined,
    })
    toast.success(t('Download started ({version})', { version }))
  } catch (e) {
    toast.error(e.message || t('Download failed'))
  }
}

function formatReleasedAt(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

const step2Done = computed(() => step.value > 2)
const step1Done = computed(() => step.value > 1)
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader showBack :title="t('Updates')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">

      <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
        <div class="px-3 py-2.5 flex items-center justify-between gap-2 border-b border-border/60">
          <span class="text-xs text-muted">{{ t('Installed version') }}</span>
          <span class="text-xs font-mono text-light">{{ versionState.current }}</span>
        </div>
        <div class="px-3 py-2.5 flex items-center justify-between gap-2">
          <span class="text-xs text-muted">{{ t('Latest version') }}</span>
          <span class="text-xs font-mono" :class="hasUpdate ? 'text-alert' : 'text-light'">
            {{ versionState.latest ?? '—' }}
          </span>
        </div>
      </div>

      <div class="bg-surface-soft border border-border rounded-xl p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-light">{{ t('Extension folder') }}</span>
          <BaseButton
            v-if="!editingPath"
            variant="square-sm"
            :icon="hasPath ? 'mdiPencil' : 'mdiPlus'"
            :icon-size="13"
            :tooltip="hasPath ? t('Edit') : t('Add path')"
            @click="startEditingPath"
          />
        </div>

        <p v-if="!hasPath && !editingPath" class="text-[11px] text-muted/70 leading-snug">
          {{ t('Optional. Save the path once so updates can copy it directly to the clipboard.') }}
        </p>

        <p v-else-if="hasPath && !editingPath" class="text-[11px] font-mono text-muted break-all">
          {{ pathState.path }}
        </p>

        <div v-if="editingPath" class="flex flex-col gap-2">
          <input
            v-model="pathDraft"
            type="text"
            spellcheck="false"
            :placeholder="'C:\\Users\\…\\extension'"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-light font-mono outline-none focus:border-primary/50 placeholder:text-muted/40"
            @keydown.enter="savePath"
            @keydown.escape="cancelPathEdit"
          />
          <p class="text-[10px] text-muted/60 leading-snug">
            {{ t('Find the path in chrome://extensions/ → Details → Path.') }}
          </p>
          <div class="flex gap-2">
            <BaseButton variant="ghost" class="flex-1 py-2! text-xs!" @click="cancelPathEdit">
              {{ t('Cancel') }}
            </BaseButton>
            <BaseButton class="flex-1 py-2! text-xs!" @click="savePath">
              {{ t('Save') }}
            </BaseButton>
          </div>
          <button
            v-if="hasPath"
            @click="clearPath(); pathDraft = ''"
            class="text-[10px] text-error/70 hover:text-error self-start"
          >
            {{ t('Remove path') }}
          </button>
        </div>
      </div>

      <div v-if="hasUpdate" class="flex flex-col gap-3">

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="border rounded-xl px-3 py-2.5 flex flex-col items-start gap-0.5 transition-colors text-left"
            :class="method === 'auto' ? 'bg-alert/10 border-alert/40' : 'bg-surface-soft border-border opacity-60 hover:opacity-100'"
            :disabled="!hasPath"
            @click="method = 'auto'"
          >
            <span class="text-xs font-medium text-light">{{ t('Auto-Update') }}</span>
            <span class="text-[10px] text-muted leading-snug">{{ isMac ? t('Run update.sh — 1 click + reload') : t('Run update.bat — 1 click + reload') }}</span>
          </button>
          <button
            type="button"
            class="border rounded-xl px-3 py-2.5 flex flex-col items-start gap-0.5 transition-colors text-left"
            :class="method === 'manual' ? 'bg-alert/10 border-alert/40' : 'bg-surface-soft border-border opacity-60 hover:opacity-100'"
            @click="method = 'manual'"
          >
            <span class="text-xs font-medium text-light">{{ t('Manual') }}</span>
            <span class="text-[10px] text-muted leading-snug">{{ t('Download ZIP, replace, reload') }}</span>
          </button>
        </div>

        <p v-if="!hasPath" class="text-[10px] text-muted/60 leading-snug -mt-1">
          {{ t('Save the extension folder path above to enable auto-update.') }}
        </p>

        <template v-if="method === 'auto'">
          <div
            class="border rounded-xl p-3 flex flex-col gap-2 transition-colors"
            :class="step === 1 ? 'bg-alert/10 border-alert/40' : 'bg-surface-soft border-border opacity-60'"
          >
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                :class="step1Done ? 'bg-success text-black' : 'bg-alert text-black'"
              >{{ step1Done ? '✓' : '1' }}</span>
              <span class="text-xs font-medium text-light">{{ isMac ? t('Run update.sh') : t('Run update.bat') }}</span>
            </div>
            <p class="text-[11px] text-muted leading-snug">
              {{ isMac
                ? t('Copies the bash command. Paste in Terminal, hit Enter — the script downloads and replaces all files.')
                : t('Copies the script path. Paste in Win+R, hit Enter — the script downloads and replaces all files.') }}
            </p>
            <BaseButton
              variant="primary"
              icon="mdiConsole"
              :icon-size="14"
              @click="copyUpdateScriptPath"
            >
              {{ isMac ? t('Copy update.sh command') : t('Copy update.bat path') }}
            </BaseButton>
          </div>

          <div
            class="border rounded-xl p-3 flex flex-col gap-2 transition-colors"
            :class="step === 2 ? 'bg-alert/10 border-alert/40' : 'bg-surface-soft/40 border-border/40 opacity-40'"
          >
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                :class="step === 2 ? 'bg-alert text-black' : 'bg-surface-soft text-muted'"
              >2</span>
              <span class="text-xs font-medium text-light">{{ t('Reload the extension') }}</span>
            </div>
            <p class="text-[11px] text-muted leading-snug">
              {{ t('Once the script finished, reload to activate the new version.') }}
            </p>
            <BaseButton
              variant="primary"
              icon="mdiRefresh"
              :icon-size="14"
              :disabled="step < 2"
              @click="reloadExtension"
            >
              {{ t('Reload extension') }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              icon="mdiPuzzle"
              :icon-size="14"
              :disabled="step < 2"
              @click="openExtensionsPage"
            >
              {{ t('Open extensions page') }}
            </BaseButton>
          </div>
        </template>

        <template v-else>
          <div
            class="border rounded-xl p-3 flex flex-col gap-2 transition-colors"
            :class="step === 1 ? 'bg-alert/10 border-alert/40' : 'bg-surface-soft border-border opacity-60'"
          >
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                :class="step1Done ? 'bg-success text-black' : 'bg-alert text-black'"
              >{{ step1Done ? '✓' : '1' }}</span>
              <span class="text-xs font-medium text-light">{{ t('Download ZIP') }}</span>
            </div>
            <BaseButton
              variant="primary"
              icon="mdiDownload"
              :icon-size="14"
              :loading="downloading"
              @click="downloadUpdate"
            >
              {{ t('Download update ({version})', { version: versionState.latest }) }}
            </BaseButton>
          </div>

          <div
            class="border rounded-xl p-3 flex flex-col gap-2 transition-colors"
            :class="step === 2 ? 'bg-alert/10 border-alert/40' : (step2Done ? 'bg-surface-soft border-border opacity-60' : 'bg-surface-soft/40 border-border/40 opacity-40')"
          >
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                :class="step2Done ? 'bg-success text-black' : (step === 2 ? 'bg-alert text-black' : 'bg-surface-soft text-muted')"
              >{{ step2Done ? '✓' : '2' }}</span>
              <span class="text-xs font-medium text-light">{{ t('Replace files in extension folder') }}</span>
            </div>

            <p v-if="hasPath" class="text-[11px] text-muted leading-snug">
              {{ t('Copies the extension folder path so you can paste it in Win+R and replace the files there.') }}
            </p>
            <p v-else class="text-[11px] text-muted leading-snug">
              {{ t('Unzip the downloaded ZIP and copy the files into your extension folder.') }}
            </p>

            <BaseButton
              v-if="hasPath"
              variant="primary"
              icon="mdiClipboardTextOutline"
              :icon-size="14"
              :disabled="step < 2"
              @click="copyExtensionPath"
            >
              {{ t('Copy extension folder path') }}
            </BaseButton>
            <BaseButton
              v-else
              variant="primary"
              icon="mdiFolderOpen"
              :icon-size="14"
              :disabled="step < 2"
              @click="showInDownloads"
            >
              {{ t('Show ZIP in file explorer') }}
            </BaseButton>
          </div>

          <div
            class="border rounded-xl p-3 flex flex-col gap-2 transition-colors"
            :class="step === 3 ? 'bg-alert/10 border-alert/40' : 'bg-surface-soft/40 border-border/40 opacity-40'"
          >
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                :class="step === 3 ? 'bg-alert text-black' : 'bg-surface-soft text-muted'"
              >3</span>
              <span class="text-xs font-medium text-light">{{ t('Reload the extension') }}</span>
            </div>
            <p class="text-[11px] text-muted leading-snug">
              {{ t('After replacing the files, reload to activate the new version.') }}
            </p>
            <BaseButton
              variant="primary"
              icon="mdiRefresh"
              :icon-size="14"
              :disabled="step < 3"
              @click="reloadExtension"
            >
              {{ t('Reload extension') }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              icon="mdiPuzzle"
              :icon-size="14"
              :disabled="step < 3"
              @click="openExtensionsPage"
            >
              {{ t('Open extensions page') }}
            </BaseButton>
          </div>
        </template>

      </div>

      <div v-else class="bg-surface-soft border border-border rounded-xl px-3 py-3 flex items-center justify-between gap-2">
        <span class="text-[11px] text-muted">
          {{ versionState.latest ? t('You are on the latest version.') : t('Checking for updates…') }}
        </span>
        <BaseButton
          variant="square-sm"
          icon="mdiRefresh"
          :icon-size="14"
          :tooltip="t('Check now')"
          @click="refreshVersion"
        />
      </div>

      <div v-if="versionState.releases.length" class="flex flex-col gap-2 mt-2">
        <SectionLabel>{{ t('Version history') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl divide-y divide-border/40">
          <div
            v-for="r in versionState.releases" :key="r.sha || r.version"
            class="px-3 py-2.5 flex items-center gap-2"
          >
            <span class="text-xs font-mono text-light shrink-0 min-w-14">{{ r.version }}</span>
            <span
              v-if="r.version === versionState.current"
              class="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-success/20 text-success shrink-0"
            >{{ t('installed') }}</span>
            <span
              v-else-if="versionState.latest && compareVersions(r.version, versionState.current) > 0"
              class="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-alert/20 text-alert shrink-0"
            >{{ t('newer') }}</span>

            <span class="text-[10px] text-muted/70 flex-1 truncate">
              {{ formatReleasedAt(r.releasedAt) }}
              <span v-if="r.trigger" class="opacity-60"> · {{ r.trigger }}</span>
            </span>

            <BaseButton
              variant="square-sm"
              icon="mdiDownload"
              :icon-size="13"
              :tooltip="t('Download {version}.zip', { version: r.version })"
              @click="downloadVersion(r.version)"
            />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
