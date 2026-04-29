<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter }       from 'vue-router'
import { useSiteCheck }    from '../composables/useSiteCheck.js'
import { useCheckStore }   from '../composables/useCheckStore.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'

const router = useRouter()
const { loadPreflight, start, pause, resume, cancel, highlightCheckTab, store } = useSiteCheck()
const checkStore                                                                = useCheckStore()
const { modules }                                                               = useModuleLoader('web-checker')

function pathOf(url) {
  try { return new URL(url).pathname } catch { return url }
}

const activeTabUrl = ref('')
onMounted(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  activeTabUrl.value = tab?.url ?? ''

  const newOrigin     = activeOrigin.value
  if (!newOrigin) return
  const originChanged = store.state.origin && store.state.origin !== newOrigin
  if ((isIdle.value || originChanged) && !isActive.value) {
    loadPreflight(newOrigin)
  }
})
const activeOrigin = computed(() => { try { return new URL(activeTabUrl.value).origin } catch { return '' } })
const activeHost   = computed(() => { try { return new URL(activeTabUrl.value).hostname } catch { return '' } })
const sitemapUrl   = computed(() => activeOrigin.value ? `${activeOrigin.value}/sitemap.xml` : '')

const isIdle      = computed(() => store.state.status === 'idle')
const isFetching  = computed(() => store.state.status === 'fetching')
const isPreflight = computed(() => store.state.status === 'preflight')
const isRunning   = computed(() => store.state.status === 'running')
const isPaused    = computed(() => store.state.status === 'paused')
const isDone      = computed(() => store.state.status === 'done')
const isActive    = computed(() => isRunning.value || isPaused.value)
const isBusy      = computed(() => isFetching.value || isActive.value)

const selectedUrlCount    = computed(() => store.state.urls.filter(u => store.isUrlSelected(u)).length)
const selectedModuleCount = computed(() => modules.filter(m => store.isModuleSelected(m.id)).length)
const allUrlsSelected     = computed(() => selectedUrlCount.value    === store.state.urls.length && store.state.urls.length > 0)
const allModulesSelected  = computed(() => selectedModuleCount.value === modules.length          && modules.length > 0)

function toggleAllUrls()    { store.setAllUrlsSelected(store.state.urls,        !allUrlsSelected.value) }
function toggleAllModules() { store.setAllModulesSelected(modules.map(m => m.id), !allModulesSelected.value) }

const canStart = computed(() => isPreflight.value && selectedUrlCount.value > 0 && selectedModuleCount.value > 0)

const activeTab = ref('modules')

const total       = computed(() => store.state.urls.length)
const checkedCount = computed(() =>
  store.state.urls.filter(url => {
    const mods = store.state.results[url]
    if (!mods) return false
    return Object.entries(mods).some(([k, r]) => k !== '__page__' && r.status !== 'skipped')
  }).length,
)
const progressPct = computed(() => selectedUrlCount.value
  ? Math.round((checkedCount.value / selectedUrlCount.value) * 100)
  : 0,
)

const runningModuleNames = computed(() =>
  store.state.runningModuleIds
    .map(id => modules.find(m => m.id === id)?.name)
    .filter(Boolean)
)

const queue = computed(() => store.state.urls.map(url => {
  const mods = store.state.results[url]
  if (!mods) {
    return {
      url,
      status:       store.state.currentUrl === url ? 'running' : 'pending',
      errorCount:   0,
      warningCount: 0,
    }
  }
  const moduleResults = Object.entries(mods).filter(([k]) => k !== '__page__')
  const allSkipped    = moduleResults.length > 0 && moduleResults.every(([, r]) => r.status === 'skipped')
  if (allSkipped) {
    return { url, status: 'skipped', errorCount: 0, warningCount: 0 }
  }
  let errorCount = 0, warningCount = 0
  for (const r of Object.values(mods)) {
    errorCount   += r.errorCount   ?? 0
    warningCount += r.warningCount ?? 0
  }
  return {
    url,
    status: mods.__page__?.status === 'error' ? 'error' : 'done',
    errorCount,
    warningCount,
  }
}))

function tier(row) {
  if (row.status === 'skipped') return 3
  if (row.errorCount   > 0)     return 0
  if (row.warningCount > 0)     return 1
  return 2
}
const sortedQueue = computed(() =>
  isDone.value
    ? [...queue.value].sort((a, b) => tier(a) - tier(b) || b.errorCount - a.errorCount || b.warningCount - a.warningCount)
    : queue.value,
)

const totalErrors   = computed(() => queue.value.reduce((s, r) => s + r.errorCount,   0))
const totalWarnings = computed(() => queue.value.reduce((s, r) => s + r.warningCount, 0))

async function reloadSitemap() {
  if (!activeOrigin.value) return
  loadPreflight(activeOrigin.value)
}

async function startCheck() {
  start()
}

const navigatingUrl = ref(null)

async function openSinglePage(url) {
  if (navigatingUrl.value) return
  navigatingUrl.value = url
  try {
    const newTab = await chrome.tabs.create({ url, active: true })
    await waitForComplete(newTab.id)
    await sleep(400)

    // tab.url/title from create() are not final; re-fetch for canonical post-redirect values
    const finalTab = await chrome.tabs.get(newTab.id)

    hydrateCheckStore(url, finalTab)
    router.replace('/service/web-checker')
  } finally {
    navigatingUrl.value = null
  }
}

function hydrateCheckStore(url, tab) {
  checkStore.reset()
  const cached = store.state.results[url] ?? {}
  for (const [modId, r] of Object.entries(cached)) {
    if (modId === '__page__') continue
    if (r.status === 'skipped') {
      checkStore.setSkipped(modId, 'URL-Filter (fullSite)')
      continue
    }
    const { status, ...rest } = r
    checkStore.setResult(modId, rest)
  }
  checkStore.setCheckedTab(tab)
}

function waitForComplete(tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error(`Tab-Load Timeout (${timeoutMs}ms)`))
    }, timeoutMs)
    const listener = (id, info) => {
      if (id !== tabId) return
      if (info.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

onUnmounted(() => cancel())
</script>

<template>
  <div class="h-screen bg-background flex flex-col">
    <AppHeader showBack title="Komplette Website" subtitle="Sitemap-basierter Check" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-3 min-h-0">

      <template v-if="isIdle || isFetching || isPreflight">
        <div class="bg-surface-soft border border-border rounded-xl px-3 py-2.5 flex flex-col gap-1 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <Icon name="mdiSitemap" :size="13" class="text-muted shrink-0" />
            <span class="text-[10px] uppercase tracking-wide text-muted/70 shrink-0">Domain</span>
            <span class="text-xs font-mono text-light truncate flex-1">{{ activeHost || '—' }}</span>
          </div>
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-3.5 shrink-0" />
            <span class="text-[10px] uppercase tracking-wide text-muted/70 shrink-0">Sitemap</span>
            <a
              v-if="sitemapUrl"
              :href="sitemapUrl" target="_blank" rel="noopener"
              class="text-xs font-mono text-primary hover:underline truncate flex-1 inline-flex items-center gap-1"
              :title="sitemapUrl"
            >
              <span class="truncate">{{ sitemapUrl }}</span>
              <Icon name="mdiOpenInNew" :size="11" class="shrink-0" />
            </a>
            <span v-else class="text-xs text-muted">—</span>
          </div>
        </div>

        <div class="flex border-b border-border shrink-0 -mx-4 px-4">
          <button
            @click="activeTab = 'modules'"
            class="flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5"
            :class="activeTab === 'modules'
              ? 'text-primary border-primary'
              : 'text-muted border-transparent hover:text-light'"
          >
            <Icon name="mdiViewModule" :size="13" />
            Module
            <span class="text-[10px] font-mono opacity-60">{{ selectedModuleCount }}/{{ modules.length }}</span>
          </button>
          <button
            @click="activeTab = 'urls'"
            class="flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5"
            :class="activeTab === 'urls'
              ? 'text-primary border-primary'
              : 'text-muted border-transparent hover:text-light'"
          >
            <Icon name="mdiFileTree" :size="13" />
            Seiten
            <span class="text-[10px] font-mono opacity-60">
              {{ isPreflight ? `${selectedUrlCount}/${store.state.urls.length}` : '…' }}
            </span>
          </button>
        </div>

        <div class="flex-1 min-h-0 flex flex-col bg-surface-soft border border-border rounded-xl overflow-hidden">

          <template v-if="activeTab === 'modules'">
            <div class="px-3 py-2 border-b border-border/60 flex items-center justify-between shrink-0">
              <span class="text-[11px] text-muted">Wähle die Module, die laufen sollen.</span>
              <button
                @click="toggleAllModules"
                class="text-[11px] text-primary hover:underline shrink-0"
              >
                {{ allModulesSelected ? 'Alle abwählen' : 'Alle auswählen' }}
              </button>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto">
              <label
                v-for="mod in modules" :key="mod.id"
                class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-soft-hover border-b border-border/30 last:border-b-0"
              >
                <input
                  type="checkbox"
                  :checked="store.isModuleSelected(mod.id)"
                  @change="store.setModuleSelected(mod.id, $event.target.checked)"
                  class="w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
                />
                <Icon v-if="mod.icon?.startsWith('mdi')" :name="mod.icon" :size="13" class="text-muted shrink-0" />
                <span class="text-xs text-light flex-1 truncate">{{ mod.name }}</span>
              </label>
            </div>
          </template>

          <template v-else>
            <div class="px-3 py-2 border-b border-border/60 flex items-center justify-between shrink-0">
              <span class="text-[11px] text-muted">
                {{ isPreflight ? 'Wähle die Seiten, die geprüft werden.' : 'Sitemap wird gelesen…' }}
              </span>
              <button
                v-if="isPreflight"
                @click="toggleAllUrls"
                class="text-[11px] text-primary hover:underline shrink-0"
              >
                {{ allUrlsSelected ? 'Alle abwählen' : 'Alle auswählen' }}
              </button>
            </div>
            <div v-if="!isPreflight" class="flex-1 flex flex-col items-center justify-center gap-2 py-6">
              <LoadingSpinner size="sm" />
              <p class="text-[11px] text-muted">Sitemap wird gelesen…</p>
            </div>
            <div v-else class="flex-1 min-h-0 overflow-y-auto">
              <label
                v-for="url in store.state.urls" :key="url"
                class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-soft-hover border-b border-border/30 last:border-b-0"
              >
                <input
                  type="checkbox"
                  :checked="store.isUrlSelected(url)"
                  @change="store.setUrlSelected(url, $event.target.checked)"
                  class="w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
                />
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-xs text-light truncate">{{ pathOf(url) }}</span>
                  <span class="text-[10px] text-muted/60 truncate">{{ url }}</span>
                </div>
              </label>
            </div>
          </template>
        </div>
      </template>

      <template v-else-if="store.state.status === 'error'">
        <AlertItem type="error">{{ store.state.error }}</AlertItem>
      </template>

      <template v-else>

        <div v-if="isActive" class="flex flex-col gap-1.5 shrink-0">
          <div class="flex items-center justify-between text-xs">
            <span :class="isPaused ? 'text-alert' : 'text-muted'">
              {{ isPaused ? 'Pausiert' : 'Prüfung läuft' }}
            </span>
            <span class="font-mono text-light">{{ checkedCount }} / {{ selectedUrlCount }}</span>
          </div>
          <div class="h-1.5 bg-surface-soft rounded-full overflow-hidden">
            <div class="h-full transition-all duration-300"
              :class="isPaused ? 'bg-alert' : 'bg-primary'"
              :style="{ width: progressPct + '%' }"
            />
          </div>
        </div>

        <div v-if="isActive && store.state.currentUrl"
          class="bg-surface-soft border rounded-xl px-3 py-2.5 flex flex-col gap-1 shrink-0"
          :class="isPaused ? 'border-alert/40' : 'border-primary/40'"
        >
          <div class="flex items-center gap-2">
            <LoadingSpinner v-if="isRunning" size="sm" />
            <Icon v-else name="mdiPause" :size="14" class="text-alert shrink-0" />
            <span class="text-xs text-light truncate flex-1" :title="store.state.currentUrl">
              {{ pathOf(store.state.currentUrl) }}
            </span>
          </div>
          <div v-if="isRunning && runningModuleNames.length" class="text-[10px] text-muted/70 pl-6 truncate">
            {{ runningModuleNames.join(' · ') }}
          </div>
        </div>

        <div v-if="isActive"
          class="flex items-center justify-between gap-2 bg-surface-soft/50 border border-border/60 rounded-xl px-3 py-2 shrink-0"
        >
          <div class="flex items-start gap-2 min-w-0 flex-1">
            <Icon name="mdiAlertOutline" :size="13" class="text-alert shrink-0 mt-0.5" />
            <p class="text-[11px] text-muted leading-snug">
              Hintergrund-Tab nicht schließen — sonst bricht die Prüfung ab.
            </p>
          </div>
          <button
            @click="highlightCheckTab"
            class="text-[11px] px-2 py-1 rounded-lg bg-surface border border-border text-light hover:bg-surface-soft-hover transition-colors shrink-0 inline-flex items-center gap-1"
            title="Prüfungs-Tab in den Vordergrund holen"
          >
            <Icon name="mdiTabSearch" :size="12" />
            Tab anzeigen
          </button>
        </div>

        <div v-if="isDone" class="grid grid-cols-3 gap-2 shrink-0">
          <StatBox label="Seiten">{{ total }}</StatBox>
          <StatBox label="Fehler" :variant="totalErrors > 0 ? 'neutral' : 'success'">
            <span :class="totalErrors > 0 ? 'text-error' : ''">{{ totalErrors }}</span>
          </StatBox>
          <StatBox label="Warnungen">
            <span :class="totalWarnings > 0 ? 'text-alert' : ''">{{ totalWarnings }}</span>
          </StatBox>
        </div>

        <p v-if="isDone" class="text-[11px] text-muted/70 px-1 leading-relaxed shrink-0">
          Klicke auf eine Seite, um sie in einem neuen Tab zu öffnen — die
          Sidebar zeigt dann die Detailergebnisse wie bei einem Single-Check.
        </p>

        <div class="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
          <button
            v-for="row in sortedQueue" :key="row.url"
            :disabled="row.status !== 'done' || navigatingUrl !== null"
            @click="openSinglePage(row.url)"
            class="border rounded-xl px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors"
            :class="[
              row.status === 'pending'  && 'bg-surface-soft/30 border-border/40 opacity-60 cursor-default',
              row.status === 'running'  && 'bg-surface-soft border-primary/40 cursor-default',
              row.status === 'error'    && 'bg-surface-soft border-error/40 cursor-default',
              row.status === 'skipped'  && 'bg-surface-soft/20 border-border/30 opacity-50 cursor-default',
              row.status === 'done'     && 'bg-surface-soft border-border cursor-pointer hover:border-primary/40 hover:bg-surface-soft-hover',
              navigatingUrl === row.url && 'ring-2 ring-primary/60',
            ]"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <template v-if="row.status === 'done'">
                <span v-if="row.errorCount > 0"
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-error-soft text-error shrink-0 min-w-7 text-center"
                >{{ row.errorCount }} F</span>
                <span v-else-if="row.warningCount > 0"
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-alert-soft text-alert shrink-0 min-w-7 text-center"
                >{{ row.warningCount }} W</span>
                <span v-else
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-success-soft text-success shrink-0 min-w-7 text-center"
                >✓</span>
              </template>

              <LoadingSpinner v-else-if="row.status === 'running' || navigatingUrl === row.url" size="sm" class="shrink-0" />

              <Icon v-else-if="row.status === 'error'"
                name="mdiAlertCircle" :size="14" class="text-error shrink-0"
              />
              <span v-else-if="row.status === 'skipped'"
                class="text-[10px] text-muted/60 shrink-0 px-1.5 py-0.5 rounded bg-surface min-w-7 text-center"
                title="Übersprungen — vor dem Start abgewählt"
              >–</span>
              <span v-else class="text-muted/40 shrink-0 text-xs w-7 text-center">○</span>

              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-xs text-light truncate" :title="row.url">{{ pathOf(row.url) }}</span>
                <span v-if="row.status === 'done' && row.errorCount > 0 && row.warningCount > 0"
                  class="text-[10px] text-muted/60 truncate"
                >+{{ row.warningCount }} Warnung{{ row.warningCount === 1 ? '' : 'en' }}</span>
              </div>
            </div>

            <Icon v-if="row.status === 'done' && navigatingUrl !== row.url"
              name="mdiOpenInNew" :size="12" class="text-muted/50 shrink-0"
            />
          </button>
        </div>
      </template>

    </div>

    <div class="px-4 pt-3 pb-5 bg-background border-t border-border shrink-0">
      <BaseButton v-if="isPreflight" :disabled="!canStart" @click="startCheck">
        Prüfung starten
        <span class="text-[11px] opacity-70 font-normal ml-1">
          ({{ selectedUrlCount }} Seiten · {{ selectedModuleCount }} Module)
        </span>
      </BaseButton>

      <BaseButton v-else-if="isDone" @click="reloadSitemap">
        Erneut prüfen
      </BaseButton>

      <BaseButton v-else-if="isFetching || isIdle" :loading="true">
        <template #loading>Sitemap wird gelesen…</template>
      </BaseButton>

      <div v-else-if="isActive" class="flex gap-2">
        <BaseButton v-if="isRunning" @click="pause">
          <span class="inline-flex items-center justify-center gap-1.5">
            <Icon name="mdiPause" :size="14" />
            Pausieren
          </span>
        </BaseButton>
        <BaseButton v-else @click="resume">
          <span class="inline-flex items-center justify-center gap-1.5">
            <Icon name="mdiPlay" :size="14" />
            Fortführen
          </span>
        </BaseButton>
        <BaseButton variant="ghost" @click="cancel">
          Abbrechen
        </BaseButton>
      </div>

      <BaseButton v-else-if="store.state.status === 'error'" @click="reloadSitemap">
        Erneut versuchen
      </BaseButton>
    </div>
  </div>
</template>
