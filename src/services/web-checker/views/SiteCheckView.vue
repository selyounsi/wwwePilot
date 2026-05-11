<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter }       from 'vue-router'
import { useSiteCheck }    from '../composables/useSiteCheck.js'
import { useCheckStore }   from '../composables/useCheckStore.js'
import { useWebChecker }   from '../composables/useWebChecker.js'
import { useModuleLoader } from '@/composables/loaders/useModuleLoader.js'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useClaude }       from '@/services/chatbot/modules/claude/composables/useClaude.js'
import ClaudeButton        from '@/services/chatbot/modules/claude/components/ClaudeButton.vue'
import ClaudeResult        from '@/services/chatbot/modules/claude/components/ClaudeResult.vue'

const router = useRouter()
const { loadPreflight, start, pause, resume, cancel, highlightCheckTab, store } = useSiteCheck()
const checkStore                                                                = useCheckStore()
const { silentRefresh }                                                         = useWebChecker()
const { modules }                                                               = useModuleLoader('web-checker')
const { t }                                                                     = useI18n()

function pathOf(url) {
  try { return new URL(url).pathname } catch { return url }
}

// Builds a flat list ordered by tree-traversal with `depth` and `descendants`
// metadata. Root `/` is never a parent — top-level pages like `/blog/` and
// `/about/` stay siblings of the home page rather than nested under it.
// Trailing slashes are normalised so `/blog/` correctly parents `/blog/post-1`.
function buildUrlTree(urls) {
  function norm(u) {
    const p = pathOf(u).replace(/\/+$/, '')
    return p || '/'
  }

  const sorted = [...urls].sort((a, b) => norm(a).localeCompare(norm(b)))
  const nodes  = sorted.map(url => ({
    url, path: norm(url), depth: 0, parent: null, children: [], descendants: [],
  }))
  const byPath = new Map(nodes.map(n => [n.path, n]))

  for (const node of nodes) {
    if (node.path === '/') continue
    const segments = node.path.split('/').filter(Boolean)
    for (let i = segments.length - 1; i >= 1; i--) {
      const candidate = '/' + segments.slice(0, i).join('/')
      const parent = byPath.get(candidate)
      if (parent && parent !== node) {
        node.parent = parent
        node.depth  = parent.depth + 1
        parent.children.push(node)
        break
      }
    }
  }

  for (const node of nodes) {
    const stack = [...node.children]
    while (stack.length) {
      const c = stack.pop()
      node.descendants.push(c)
      stack.push(...c.children)
    }
  }

  const roots  = nodes.filter(n => !n.parent)
  const result = []
  function visit(n) {
    result.push(n)
    n.children.sort((a, b) => a.path.localeCompare(b.path)).forEach(visit)
  }
  roots.sort((a, b) => a.path.localeCompare(b.path)).forEach(visit)
  return result
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

const urlTree = computed(() => buildUrlTree(store.state.urls))

const collapsedPaths = reactive(new Set())

function isExpanded(node) { return !collapsedPaths.has(node.path) }

function toggleExpanded(node) {
  if (collapsedPaths.has(node.path)) collapsedPaths.delete(node.path)
  else                               collapsedPaths.add(node.path)
}

function expandAll()   { collapsedPaths.clear() }
function collapseAll() {
  collapsedPaths.clear()
  for (const node of urlTree.value) {
    if (node.children.length) collapsedPaths.add(node.path)
  }
}

const anyCollapsed = computed(() => collapsedPaths.size > 0)

// DFS-ordered tree filtered by collapse state — children of a collapsed node
// (and their descendants) are hidden, regardless of their own state.
const visibleUrlTree = computed(() => {
  const hiddenAncestors = new Set()
  return urlTree.value.filter(node => {
    if (node.parent && hiddenAncestors.has(node.parent.path)) {
      hiddenAncestors.add(node.path)
      return false
    }
    if (!isExpanded(node)) hiddenAncestors.add(node.path)
    return true
  })
})

function onUrlChecked(node, checked) {
  store.setUrlSelected(node.url, checked)
  for (const d of node.descendants) store.setUrlSelected(d.url, checked)
}

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

const resultsView    = ref('pages')
const expandedModules = reactive(new Set())
function toggleModuleExpanded(id) {
  if (expandedModules.has(id)) expandedModules.delete(id)
  else                         expandedModules.add(id)
}

const moduleAggregate = computed(() => {
  const out = {}
  for (const url of store.state.urls) {
    const mods = store.state.results[url]
    if (!mods) continue
    for (const [modId, r] of Object.entries(mods)) {
      if (modId === '__page__' || r.status === 'skipped') continue
      if (!out[modId]) {
        const m = modules.find(mm => mm.id === modId)
        out[modId] = {
          id:           modId,
          name:         m?.name ?? modId,
          icon:         m?.icon,
          errorCount:   0,
          warningCount: 0,
          affectedUrls: [],
        }
      }
      const e = r.errorCount   ?? 0
      const w = r.warningCount ?? 0
      out[modId].errorCount   += e
      out[modId].warningCount += w
      if (e > 0 || w > 0) out[modId].affectedUrls.push({ url, errors: e, warnings: w })
    }
  }
  for (const m of Object.values(out)) {
    m.affectedUrls.sort((a, b) => b.errors - a.errors || b.warnings - a.warnings)
  }
  return Object.values(out).sort((a, b) => {
    const ta = a.errorCount > 0 ? 0 : a.warningCount > 0 ? 1 : 2
    const tb = b.errorCount > 0 ? 0 : b.warningCount > 0 ? 1 : 2
    return ta - tb || b.errorCount - a.errorCount || b.warningCount - a.warningCount || a.name.localeCompare(b.name)
  })
})

async function reloadSitemap() {
  if (!activeOrigin.value) return
  loadPreflight(activeOrigin.value)
}

const customSitemapUrl = ref('')

async function retryWithCustomSitemap() {
  const url = customSitemapUrl.value.trim()
  if (!url) return
  loadPreflight(activeOrigin.value, url)
}

const errorMessage = computed(() => {
  const code = store.state.errorCode
  if (code === 'NOT_FOUND')      return t('No sitemap found at {url}.', { url: store.state.sitemapUrl ?? sitemapUrl.value })
  if (code === 'NETWORK_ERROR')  return t('Could not reach the sitemap (network error).')
  if (code === 'TIMEOUT')        return t('Sitemap request timed out.')
  if (code === 'EMPTY_SITEMAP')  return t('The sitemap does not contain any URLs.')
  return store.state.error
})

async function startCheck() {
  start()
}

// "Erneut prüfen" from the done view — keep the existing selection and skip
// preflight, so the user stays on the results list while it refills.
async function recheckSameSelection() {
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

    // pinned tab's _meta indices can drift from the new active tab; refresh silently
    silentRefresh(finalTab.id)
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

const claude = useClaude()
const reportOpen    = ref(false)
const reportLoading = ref(false)
const reportText    = ref('')
const reportError   = ref('')

async function buildReport() {
  reportOpen.value    = true
  reportText.value    = ''
  reportError.value   = ''
  reportLoading.value = true
  try {
    const perModule = {}
    let totalErrors = 0, totalWarnings = 0
    for (const url of store.state.urls) {
      const mods = store.state.results[url]
      if (!mods) continue
      for (const [modId, r] of Object.entries(mods)) {
        if (modId === '__page__' || r.status === 'skipped') continue
        const mod = modules.find(m => m.id === modId)
        if (!mod) continue
        const slot = perModule[modId] ?? (perModule[modId] = { name: mod.name, errors: 0, warnings: 0, samplePages: [] })
        slot.errors   += r.errorCount   ?? 0
        slot.warnings += r.warningCount ?? 0
        if ((r.errorCount ?? 0) > 0 && slot.samplePages.length < 3) {
          slot.samplePages.push({ url, errors: r.errorCount, warnings: r.warningCount })
        }
        totalErrors   += r.errorCount   ?? 0
        totalWarnings += r.warningCount ?? 0
      }
    }

    const summary = Object.entries(perModule)
      .filter(([, v]) => v.errors > 0 || v.warnings > 0)
      .map(([id, v]) => `Modul "${v.name}" (${id}): ${v.errors} Fehler, ${v.warnings} Warnungen` +
        (v.samplePages.length ? `\n  Beispielseiten: ${v.samplePages.map(p => p.url).join(', ')}` : ''))
      .join('\n')

    const userMessage = [
      `Domain: ${store.state.origin}`,
      `Geprüfte Seiten: ${store.state.urls.length}`,
      `Gesamt: ${totalErrors} Fehler, ${totalWarnings} Warnungen`,
      '',
      'Pro-Modul-Aggregat:',
      summary || '(keine Probleme)',
    ].join('\n')

    const result = await claude.run({
      max_tokens: 1200,
      system: 'Du schreibst einen kurzen Web-QA-Bericht für nicht-technische Stakeholder. ' +
              'Auf Deutsch. Struktur: 1) Eine-Satz-Fazit. 2) "Größte Risiken" (max 3 Punkte). ' +
              '3) "Empfohlene nächste Schritte" (priorisiert, max 5 Punkte). Keine Floskeln, kein Marketing-Sprech.',
      messages: [{ role: 'user', content: userMessage }],
    })
    reportText.value = result.text
  } catch (e) {
    reportError.value = e.message || String(e)
  } finally {
    reportLoading.value = false
  }
}
</script>

<template>
  <div class="h-full bg-background flex flex-col">
    <AppHeader showBack :title="t('Full Website')" :subtitle="t('Sitemap-based check')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-3 min-h-0">

      <template v-if="isIdle || isFetching || isPreflight">
        <div class="bg-surface-soft border border-border rounded-xl px-3 py-2.5 flex flex-col gap-1 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] uppercase tracking-wide text-muted/70 shrink-0">{{ t('Domain') }}</span>
            <span class="text-xs font-mono text-light truncate flex-1">{{ activeHost || '—' }}</span>
          </div>
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] uppercase tracking-wide text-muted/70 shrink-0">{{ t('Sitemap') }}</span>
            <Tooltip v-if="sitemapUrl" :text="sitemapUrl">
              <a
                :href="sitemapUrl" target="_blank" rel="noopener"
                class="text-xs font-mono text-primary hover:underline truncate flex-1 inline-flex items-center gap-1"
              >
                <span class="truncate">{{ sitemapUrl }}</span>
                <Icon name="mdiOpenInNew" :size="11" class="shrink-0" />
              </a>
            </Tooltip>
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
            {{ t('Modules') }}
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
            {{ t('Pages') }}
            <span class="text-[10px] font-mono opacity-60">
              {{ isPreflight ? `${selectedUrlCount}/${store.state.urls.length}` : '…' }}
            </span>
          </button>
        </div>

        <div class="flex-1 min-h-0 flex flex-col bg-surface-soft border border-border rounded-xl overflow-hidden">

          <template v-if="activeTab === 'modules'">
            <div class="px-3 py-2 border-b border-border/60 flex items-center justify-between shrink-0">
              <span class="text-[11px] text-muted">{{ t('Choose the modules to run.') }}</span>
              <button
                @click="toggleAllModules"
                class="text-[11px] text-primary hover:underline shrink-0"
              >
                {{ allModulesSelected ? t('Deselect all') : t('Select all') }}
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
            <div class="px-3 py-2 border-b border-border/60 flex items-center justify-between shrink-0 gap-2">
              <span class="text-[11px] text-muted truncate">
                {{ isPreflight ? t('Choose the pages to check.') : t('Sitemap loading…') }}
              </span>
              <div v-if="isPreflight" class="flex items-center gap-3 shrink-0">
                <button
                  @click="anyCollapsed ? expandAll() : collapseAll()"
                  class="text-[11px] text-muted hover:text-light"
                >
                  {{ anyCollapsed ? t('Expand all') : t('Collapse all') }}
                </button>
                <button
                  @click="toggleAllUrls"
                  class="text-[11px] text-primary hover:underline"
                >
                  {{ allUrlsSelected ? t('Deselect all') : t('Select all') }}
                </button>
              </div>
            </div>
            <div
              v-if="isPreflight"
              class="px-3 py-2 border-b border-border/60 shrink-0 flex items-start gap-2"
            >
              <Icon name="mdiInformationOutline" :size="12" class="text-muted/70 shrink-0 mt-0.5" />
              <span class="text-[11px] text-muted/70 flex-1 leading-snug">
                {{ t('Toggling a parent also toggles its sub-pages.') }}
              </span>
            </div>
            <div v-if="!isPreflight" class="flex-1 flex flex-col items-center justify-center gap-2 py-6">
              <LoadingSpinner size="sm" />
              <p class="text-[11px] text-muted">{{ t('Sitemap loading…') }}</p>
            </div>
            <div v-else class="flex-1 min-h-0 overflow-y-auto">
              <label
                v-for="node in visibleUrlTree" :key="node.url"
                class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-soft-hover border-b border-border/30 last:border-b-0"
                :style="{ paddingLeft: (12 + node.depth * 16) + 'px' }"
              >
                <BaseButton
                  v-if="node.children.length"
                  variant="icon"
                  :icon="isExpanded(node) ? 'mdiChevronDown' : 'mdiChevronRight'"
                  :icon-size="14"
                  :tooltip="isExpanded(node) ? t('Collapse') : t('Expand')"
                  class="w-4 h-4 -ml-1 text-muted/70 hover:text-light hover:bg-surface hover:scale-100"
                  @click.stop.prevent="toggleExpanded(node)"
                />
                <span v-else class="w-4 shrink-0" aria-hidden="true" />
                <input
                  type="checkbox"
                  :checked="store.isUrlSelected(node.url)"
                  @change="onUrlChecked(node, $event.target.checked)"
                  class="w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
                />
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-xs text-light truncate">{{ pathOf(node.url) }}</span>
                  <span
                    v-if="node.children.length"
                    class="text-[10px] text-muted/60 truncate"
                  >{{ t('{n} sub-pages', { n: node.descendants.length }) }}</span>
                </div>
              </label>
            </div>
          </template>
        </div>
      </template>

      <template v-else-if="store.state.status === 'error'">
        <div class="flex flex-col gap-3">
          <AlertItem type="error">{{ errorMessage }}</AlertItem>

          <div class="bg-surface-soft border border-border rounded-xl p-3 flex flex-col gap-2">
            <label class="text-[11px] font-medium text-light">{{ t('Sitemap URL') }}</label>
            <input
              v-model="customSitemapUrl"
              type="url"
              spellcheck="false"
              :placeholder="store.state.sitemapUrl ?? sitemapUrl"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-light font-mono outline-none focus:border-primary/50 placeholder:text-muted/40"
              @keydown.enter="retryWithCustomSitemap"
            />
            <p class="text-[10px] text-muted/70 leading-snug">
              {{ t('If your sitemap lives at a different URL, enter it here.') }}
            </p>
          </div>
        </div>
      </template>

      <template v-else>

        <div v-if="isActive" class="flex flex-col gap-1.5 shrink-0">
          <div class="flex items-center justify-between text-xs">
            <span :class="isPaused ? 'text-alert' : 'text-muted'">
              {{ isPaused ? t('Paused') : t('Check running') }}
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
            <Tooltip :text="store.state.currentUrl">
              <span class="text-xs text-light truncate flex-1">
                {{ pathOf(store.state.currentUrl) }}
              </span>
            </Tooltip>
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
              {{ t("Don't close the background tab — otherwise the check will abort.") }}
            </p>
          </div>
          <BaseButton
            variant="pill"
            icon="mdiTabSearch"
            :icon-size="12"
            :tooltip="t('Bring the check tab to the foreground')"
            class="shrink-0"
            @click="highlightCheckTab"
          >
            {{ t('Show tab') }}
          </BaseButton>
        </div>

        <div v-if="isDone" class="grid grid-cols-3 gap-2 shrink-0">
          <StatBox :label="t('Pages')">{{ total }}</StatBox>
          <StatBox :label="t('Errors')" :variant="totalErrors > 0 ? 'neutral' : 'success'">
            <span :class="totalErrors > 0 ? 'text-error' : ''">{{ totalErrors }}</span>
          </StatBox>
          <StatBox :label="t('Warnings')">
            <span :class="totalWarnings > 0 ? 'text-alert' : ''">{{ totalWarnings }}</span>
          </StatBox>
        </div>

        <p v-if="isDone" class="text-[11px] text-muted/70 px-1 leading-relaxed shrink-0">
          {{ resultsView === 'pages'
            ? t('Click a page to open it in a new tab — the sidebar will then show the details like a single check.')
            : t('Click a module to see which pages are affected — then a page to open it in a new tab.') }}
        </p>

        <ClaudeButton
          v-if="isDone"
          variant="pill"
          :size="14"
          :label="t('Generate report')"
          :loading="reportLoading"
          @click="buildReport"
        />

        <div v-if="isDone" class="flex gap-2 shrink-0">
          <BaseButton
            variant="pill-toggle"
            icon="mdiFileTree"
            :icon-size="13"
            :active="resultsView === 'pages'"
            class="flex-1"
            @click="resultsView = 'pages'"
          >
            {{ t('By page') }}
          </BaseButton>
          <BaseButton
            variant="pill-toggle"
            icon="mdiViewModule"
            :icon-size="13"
            :active="resultsView === 'modules'"
            class="flex-1"
            @click="resultsView = 'modules'"
          >
            {{ t('By module') }}
          </BaseButton>
        </div>

        <div v-if="resultsView === 'pages' || !isDone" class="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
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
                >{{ row.errorCount }} {{ t('Err') }}</span>
                <span v-else-if="row.warningCount > 0"
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-alert-soft text-alert shrink-0 min-w-7 text-center"
                >{{ row.warningCount }} {{ t('Warn') }}</span>
                <span v-else
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-success-soft text-success shrink-0 min-w-7 text-center"
                >✓</span>
              </template>

              <LoadingSpinner v-else-if="row.status === 'running' || navigatingUrl === row.url" size="sm" class="shrink-0" />

              <Icon v-else-if="row.status === 'error'"
                name="mdiAlertCircle" :size="14" class="text-error shrink-0"
              />
              <Tooltip v-else-if="row.status === 'skipped'" :text="t('Skipped — deselected before start')">
                <span class="text-[10px] text-muted/60 shrink-0 px-1.5 py-0.5 rounded bg-surface min-w-7 text-center">–</span>
              </Tooltip>
              <span v-else class="text-muted/40 shrink-0 text-xs w-7 text-center">○</span>

              <div class="flex flex-col min-w-0 flex-1">
                <Tooltip :text="row.url">
                  <span class="text-xs text-light truncate">{{ pathOf(row.url) }}</span>
                </Tooltip>
                <span v-if="row.status === 'done' && row.errorCount > 0 && row.warningCount > 0"
                  class="text-[10px] text-muted/60 truncate"
                >{{ row.warningCount === 1
                  ? t('+{count} warning',  { count: row.warningCount })
                  : t('+{count} warnings', { count: row.warningCount }) }}</span>
              </div>
            </div>

            <Icon v-if="row.status === 'done' && navigatingUrl !== row.url"
              name="mdiOpenInNew" :size="12" class="text-muted/50 shrink-0"
            />
          </button>
        </div>

        <div v-else class="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
          <div v-for="mod in moduleAggregate" :key="mod.id" class="flex flex-col gap-1">
            <button
              :disabled="mod.affectedUrls.length === 0"
              @click="toggleModuleExpanded(mod.id)"
              class="border rounded-xl px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors"
              :class="mod.affectedUrls.length === 0
                ? 'bg-surface-soft/40 border-border/40 cursor-default'
                : 'bg-surface-soft border-border cursor-pointer hover:border-primary/40 hover:bg-surface-soft-hover'"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span v-if="mod.errorCount > 0"
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-error-soft text-error shrink-0 min-w-7 text-center"
                >{{ mod.errorCount }} {{ t('Err') }}</span>
                <span v-else-if="mod.warningCount > 0"
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-alert-soft text-alert shrink-0 min-w-7 text-center"
                >{{ mod.warningCount }} {{ t('Warn') }}</span>
                <span v-else
                  class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-success-soft text-success shrink-0 min-w-7 text-center"
                >✓</span>

                <Icon v-if="mod.icon && mod.icon.startsWith('mdi')" :name="mod.icon" :size="13" class="text-muted/70 shrink-0" />
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-xs text-light truncate">{{ mod.name }}</span>
                  <span v-if="mod.affectedUrls.length > 0" class="text-[10px] text-muted/60 truncate">
                    {{ mod.affectedUrls.length === 1
                      ? t('1 page affected')
                      : t('{n} pages affected', { n: mod.affectedUrls.length }) }}<span v-if="mod.errorCount > 0 && mod.warningCount > 0">
                      · {{ mod.warningCount === 1
                          ? t('+{count} warning',  { count: mod.warningCount })
                          : t('+{count} warnings', { count: mod.warningCount }) }}</span>
                  </span>
                </div>
              </div>

              <Icon v-if="mod.affectedUrls.length > 0"
                :name="expandedModules.has(mod.id) ? 'mdiChevronDown' : 'mdiChevronRight'"
                :size="14" class="text-muted/60 shrink-0"
              />
            </button>

            <div v-if="expandedModules.has(mod.id) && mod.affectedUrls.length > 0" class="flex flex-col gap-1 pl-3">
              <button
                v-for="entry in mod.affectedUrls" :key="entry.url"
                :disabled="navigatingUrl !== null"
                @click="openSinglePage(entry.url)"
                class="border rounded-xl px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors bg-surface-soft/60 border-border/60 cursor-pointer hover:border-primary/40 hover:bg-surface-soft-hover"
                :class="navigatingUrl === entry.url && 'ring-2 ring-primary/60'"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <span v-if="entry.errors > 0"
                    class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-error-soft text-error shrink-0 min-w-7 text-center"
                  >{{ entry.errors }} {{ t('Err') }}</span>
                  <span v-else
                    class="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-alert-soft text-alert shrink-0 min-w-7 text-center"
                  >{{ entry.warnings }} {{ t('Warn') }}</span>

                  <div class="flex flex-col min-w-0 flex-1">
                    <Tooltip :text="entry.url">
                      <span class="text-xs text-light truncate">{{ pathOf(entry.url) }}</span>
                    </Tooltip>
                    <span v-if="entry.errors > 0 && entry.warnings > 0"
                      class="text-[10px] text-muted/60 truncate"
                    >{{ entry.warnings === 1
                      ? t('+{count} warning',  { count: entry.warnings })
                      : t('+{count} warnings', { count: entry.warnings }) }}</span>
                  </div>
                </div>

                <LoadingSpinner v-if="navigatingUrl === entry.url" size="sm" class="shrink-0" />
                <Icon v-else name="mdiOpenInNew" :size="12" class="text-muted/50 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </template>

    </div>

    <div class="px-4 pt-3 pb-5 bg-background border-t border-border shrink-0">
      <BaseButton v-if="isPreflight" :disabled="!canStart" @click="startCheck">
        {{ t('Start check') }}
        <span class="text-[11px] opacity-70 font-normal ml-1">
          {{ t('({selected} pages · {modules} modules)', { selected: selectedUrlCount, modules: selectedModuleCount }) }}
        </span>
      </BaseButton>

      <div v-else-if="isDone" class="flex flex-col gap-2">
        <BaseButton @click="recheckSameSelection">
          {{ t('Recheck') }}
        </BaseButton>
        <BaseButton variant="ghost" @click="reloadSitemap">
          {{ t('Change selection') }}
        </BaseButton>
      </div>

      <BaseButton v-else-if="isFetching || isIdle" :loading="true">
        <template #loading>{{ t('Sitemap loading…') }}</template>
      </BaseButton>

      <div v-else-if="isActive" class="flex gap-2">
        <BaseButton v-if="isRunning" @click="pause">
          <span class="inline-flex items-center justify-center gap-1.5">
            <Icon name="mdiPause" :size="14" />
            {{ t('Pause') }}
          </span>
        </BaseButton>
        <BaseButton v-else @click="resume">
          <span class="inline-flex items-center justify-center gap-1.5">
            <Icon name="mdiPlay" :size="14" />
            {{ t('Resume') }}
          </span>
        </BaseButton>
        <BaseButton variant="ghost" @click="cancel">
          {{ t('Cancel') }}
        </BaseButton>
      </div>

      <div v-else-if="store.state.status === 'error'" class="flex flex-col gap-2">
        <BaseButton :disabled="!customSitemapUrl.trim()" @click="retryWithCustomSitemap">
          {{ t('Load this sitemap') }}
        </BaseButton>
        <BaseButton variant="ghost" @click="reloadSitemap">
          {{ t('Try default sitemap.xml again') }}
        </BaseButton>
      </div>
    </div>

    <ClaudeResult
      :open="reportOpen"
      :title="t('Site report')"
      :loading="reportLoading"
      :error="reportError"
      :text="reportText"
      @update:open="reportOpen = $event"
    />
  </div>
</template>
