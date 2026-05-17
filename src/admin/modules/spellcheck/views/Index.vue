<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminSpellcheck } from '@/admin/modules/spellcheck/composables/useAdminSpellcheck.js'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { has } = usePermissions()
const {
  state, fetchDomains, fetchDomainData, fetchRuns, fetchOverview,
  discover,
  addDictionaryWord, bulkAddDictionary, removeDictionaryWord,
  addIgnoredError, removeIgnoredError,
  checkSite,
} = useAdminSpellcheck()

const canWrite = computed(() => has('admin.spellcheck.write'))

const activeDomain = ref('')
const customDomain = ref('')

const newWord       = ref('')
const newWordForce  = ref(false)
const newIgnoredErr = ref('')

// Site-check options collapsed by default
const optionsOpen   = ref(false)
const optMaxPages   = ref('')
const optLanguage   = ref('')

const overviewOpen = ref(true)

onMounted(() => {
  fetchDomains()
  fetchOverview()
})

watch(activeDomain, (d) => {
  if (!d) return
  fetchDomainData(d)
  fetchRuns(d)
  state.discovered = null
  state.lastResult = null
})

function pickDomain(d) {
  activeDomain.value = d
}

function applyCustomDomain() {
  const d = customDomain.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!d) return
  activeDomain.value = d
}

const checking   = ref(false)
const discoverng = ref(false)

async function onDiscover() {
  if (!activeDomain.value) return
  discoverng.value = true
  try {
    await discover(activeDomain.value)
  } catch (e) { toast.error(e.message) }
  finally { discoverng.value = false }
}

async function onCheckSite() {
  if (!activeDomain.value) return
  checking.value = true
  try {
    const opts = {}
    if (optMaxPages.value) opts.maxPages = parseInt(optMaxPages.value, 10)
    if (optLanguage.value) opts.language = optLanguage.value
    await checkSite(activeDomain.value, opts)
    await fetchRuns(activeDomain.value)
    toast.success(t('Site check finished'))
  } catch (e) { toast.error(e.message) }
  finally { checking.value = false }
}

async function onAddWord() {
  if (!newWord.value.trim() || !activeDomain.value) return
  try {
    const r = await addDictionaryWord(activeDomain.value, newWord.value.trim(), newWordForce.value)
    if (r?.rejected) {
      toast.error(r.error ?? t('Word rejected by LanguageTool.'))
    } else {
      toast.success(t('Word added'))
      newWord.value = ''
      newWordForce.value = false
    }
  } catch (e) { toast.error(e.message) }
}

async function onRemoveWord(w) {
  try {
    await removeDictionaryWord(w.id)
    toast.success(t('Word removed'))
  } catch (e) { toast.error(e.message) }
}

async function onAddIgnoredError() {
  if (!newIgnoredErr.value.trim() || !activeDomain.value) return
  try {
    await addIgnoredError(activeDomain.value, newIgnoredErr.value.trim())
    toast.success(t('Ignored error added'))
    newIgnoredErr.value = ''
  } catch (e) { toast.error(e.message) }
}

async function onRemoveIgnoredError(e) {
  try {
    await removeIgnoredError(e.id)
    toast.success(t('Ignored error removed'))
  } catch (err) { toast.error(err.message) }
}

function openRunDetail(run) {
  router.push({ name: 'admin-spellcheck-run', params: { slug: run.slug } })
}

function relative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return t('just now')
  if (min < 60) return t('{n} min ago', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24)   return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} d ago', { n: d })
}

function shortHost(origin) {
  try { return new URL(origin).host } catch { return origin }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6">
      <h2 class="text-xl font-bold">{{ t('Spellcheck') }}</h2>
      <p class="text-xs text-muted mt-0.5">
        {{ t('Manage per-domain dictionaries, ignored errors, and trigger full-site checks against the SpellCheck-App.') }}
      </p>
    </header>

    <div v-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4 mb-4 text-sm text-error">
      {{ state.error }}
    </div>

    <!-- Cross-domain overview — collapsible, shown by default -->
    <section class="bg-surface-soft border border-border rounded-xl mb-4">
      <button
        class="w-full px-4 py-3 flex items-center gap-2 border-b border-border/60 hover:bg-surface-soft-hover transition-colors text-left"
        @click="overviewOpen = !overviewOpen"
      >
        <Icon name="mdiViewDashboardOutline" :size="14" class="text-primary" />
        <h3 class="text-sm font-semibold flex-1">{{ t('All domains — current state') }}</h3>
        <span class="text-[10px] text-muted">{{ state.overview.length }}</span>
        <Icon :name="overviewOpen ? 'mdiChevronUp' : 'mdiChevronDown'" :size="14" class="text-muted" />
      </button>
      <div v-if="overviewOpen">
        <div v-if="state.loadingOverview" class="px-4 py-6 text-center text-xs text-muted">{{ t('Loading…') }}</div>
        <p v-else-if="!state.overview.length" class="px-4 py-6 text-center text-xs text-muted/60 italic">
          {{ t('No spellcheck runs recorded yet.') }}
        </p>
        <table v-else class="w-full text-sm">
          <thead class="text-[10px] uppercase tracking-wide text-muted/60">
            <tr>
              <th class="text-left px-4 py-2 font-medium">{{ t('Domain') }}</th>
              <th class="text-right px-2 py-2 font-medium">{{ t('Current errors') }}</th>
              <th class="text-right px-2 py-2 font-medium">{{ t('Trend') }}</th>
              <th class="text-right px-2 py-2 font-medium">{{ t('Pages') }}</th>
              <th class="text-left px-2 py-2 font-medium">{{ t('Lang') }}</th>
              <th class="text-right px-2 py-2 font-medium">{{ t('Runs') }}</th>
              <th class="text-right px-4 py-2 font-medium">{{ t('Last run') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in state.overview" :key="row.domain"
              class="border-t border-border/30 hover:bg-surface-soft-hover cursor-pointer"
              @click="pickDomain(row.domain)"
            >
              <td class="px-4 py-2 text-xs truncate">{{ row.domain }}</td>
              <td class="px-2 py-2 text-[11px] text-right tabular-nums" :class="(row.currentErrors ?? 0) > 0 ? 'text-error' : 'text-muted/60'">
                {{ row.currentErrors ?? '—' }}
              </td>
              <td class="px-2 py-2 text-[11px] text-right tabular-nums">
                <span v-if="row.delta == null" class="text-muted/40">—</span>
                <span v-else-if="row.delta === 0" class="text-muted">±0</span>
                <span v-else-if="row.delta > 0" class="text-error inline-flex items-center gap-0.5">
                  <Icon name="mdiArrowUp" :size="10" />+{{ row.delta }}
                </span>
                <span v-else class="text-success inline-flex items-center gap-0.5">
                  <Icon name="mdiArrowDown" :size="10" />{{ row.delta }}
                </span>
              </td>
              <td class="px-2 py-2 text-[11px] text-right tabular-nums text-muted">{{ row.pagesChecked ?? '—' }}</td>
              <td class="px-2 py-2 text-[10px] font-mono text-muted">{{ row.language ?? '—' }}</td>
              <td class="px-2 py-2 text-[11px] text-right tabular-nums text-muted">{{ row.runCount }}</td>
              <td class="px-4 py-2 text-[10px] text-right text-muted whitespace-nowrap">{{ relative(row.lastRun) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid grid-cols-3 gap-4">
      <aside class="col-span-1 bg-surface-soft border border-border rounded-xl">
        <header class="px-4 py-3 border-b border-border/60">
          <h3 class="text-sm font-semibold">{{ t('Domains') }}</h3>
          <p class="text-[10px] text-muted/60 mt-0.5">{{ t('From recent check runs') }}</p>
        </header>

        <div class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
          <input
            v-model="customDomain"
            type="text"
            :placeholder="t('Or type a domain…')"
            class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary/60"
            @keydown.enter.prevent="applyCustomDomain"
          />
          <BaseButton variant="pill" icon="mdiArrowRight" :icon-size="11" @click="applyCustomDomain" />
        </div>

        <div v-if="state.loadingDomains" class="px-4 py-6 text-center text-xs text-muted">{{ t('Loading…') }}</div>
        <ul v-else class="max-h-[60vh] overflow-y-auto">
          <li v-if="!state.domains.length" class="px-4 py-4 text-xs text-muted/60 italic">{{ t('No domains yet.') }}</li>
          <li
            v-for="d in state.domains" :key="d.origin"
            class="px-4 py-2 border-b border-border/30 last:border-b-0 cursor-pointer transition-colors"
            :class="activeDomain === shortHost(d.origin) ? 'bg-primary/10' : 'hover:bg-surface-soft-hover'"
            @click="pickDomain(shortHost(d.origin))"
          >
            <div class="text-xs truncate">{{ shortHost(d.origin) }}</div>
            <div class="text-[10px] text-muted/60 mt-0.5 flex items-center justify-between">
              <span>{{ t('{n} runs', { n: d.run_count }) }}</span>
              <span>{{ relative(d.last_run) }}</span>
            </div>
          </li>
        </ul>
      </aside>

      <section class="col-span-2 space-y-4">
        <div v-if="!activeDomain" class="bg-surface-soft border border-border border-dashed rounded-xl p-8 text-center text-sm text-muted">
          {{ t('Pick a domain on the left or type one above to manage its dictionary.') }}
        </div>

        <template v-else>
          <!-- Action panel -->
          <div class="bg-surface-soft border border-border rounded-xl">
            <div class="px-4 py-3 flex items-center gap-3">
              <Icon name="mdiWeb" :size="18" class="text-primary" />
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold truncate">{{ activeDomain }}</h3>
                <p class="text-[10px] text-muted/60">{{ t('Full-site checks discover all pages via sitemap and run bulk spellcheck.') }}</p>
              </div>
              <BaseButton
                variant="pill" icon="mdiMagnify" :icon-size="13"
                :disabled="discoverng"
                @click="onDiscover"
              >{{ discoverng ? t('Discovering…') : t('Discover pages') }}</BaseButton>
              <BaseButton
                variant="pill" icon="mdiPlayCircleOutline" :icon-size="13"
                :disabled="!canWrite || checking"
                class="bg-primary! border-primary! text-black/80!"
                @click="onCheckSite"
              >{{ checking ? t('Checking…') : t('Run site check') }}</BaseButton>
            </div>

            <button
              class="w-full px-4 py-2 border-t border-border/60 text-[10px] text-muted hover:bg-surface-soft-hover flex items-center justify-center gap-1"
              @click="optionsOpen = !optionsOpen"
            >
              <Icon :name="optionsOpen ? 'mdiChevronUp' : 'mdiChevronDown'" :size="11" />
              {{ t('Site-check options') }}
            </button>
            <div v-if="optionsOpen" class="px-4 py-3 border-t border-border/60 flex flex-wrap gap-3 items-center">
              <label class="text-[10px] text-muted flex items-center gap-2">
                {{ t('Max pages') }}
                <input
                  v-model="optMaxPages"
                  type="number" min="1" max="500"
                  placeholder="—"
                  class="w-20 bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60"
                />
              </label>
              <label class="text-[10px] text-muted flex items-center gap-2">
                {{ t('Force language') }}
                <select v-model="optLanguage" class="bg-surface border border-border rounded px-2 py-1 text-xs">
                  <option value="">{{ t('Auto-detect') }}</option>
                  <option value="de-DE">de-DE</option>
                  <option value="en-US">en-US</option>
                  <option value="en-GB">en-GB</option>
                </select>
              </label>
            </div>
          </div>

          <!-- Discover preview -->
          <div v-if="state.discovered" class="bg-surface-soft border border-primary/30 rounded-xl">
            <header class="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <h4 class="text-sm font-semibold">{{ t('Discovered pages') }}</h4>
              <span class="text-[10px] text-muted">{{ state.discovered.total }}</span>
            </header>
            <ul class="max-h-48 overflow-y-auto divide-y divide-border/30">
              <li v-for="u in state.discovered.urls" :key="u" class="px-4 py-1.5 text-[11px] text-muted truncate">
                <a :href="u" target="_blank" rel="noreferrer" class="hover:text-primary">{{ u }}</a>
              </li>
            </ul>
          </div>

          <!-- Last site-check result summary (auto-shown after a check) -->
          <div v-if="state.lastResult" class="bg-surface-soft border border-primary/30 rounded-xl p-4">
            <header class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold">{{ t('Last site-check result') }}</h4>
              <BaseButton
                variant="pill" icon="mdiArrowRight" :icon-size="11"
                @click="router.push({ name: 'admin-spellcheck-run', params: { slug: state.lastResult.slug } })"
              >{{ t('Open detail') }}</BaseButton>
            </header>
            <div class="grid grid-cols-4 gap-3 text-center">
              <div>
                <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Pages') }}</div>
                <div class="text-lg font-bold tabular-nums">{{ state.lastResult.pagesChecked }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Errors') }}</div>
                <div class="text-lg font-bold tabular-nums text-error">{{ state.lastResult.totalErrors }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Duration') }}</div>
                <div class="text-lg font-bold tabular-nums">{{ state.lastResult.duration }}s</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Language') }}</div>
                <div class="text-sm font-mono mt-0.5">{{ state.lastResult.results?.[0]?.language ?? '—' }}</div>
              </div>
            </div>
          </div>

          <!-- Check history for this domain -->
          <div class="bg-surface-soft border border-border rounded-xl">
            <header class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <Icon name="mdiHistory" :size="14" class="text-muted" />
              <h4 class="text-sm font-semibold flex-1">{{ t('Check history') }}</h4>
              <span class="text-[10px] text-muted">{{ state.runs.length }}</span>
            </header>
            <div v-if="state.loadingRuns" class="px-4 py-6 text-center text-xs text-muted">{{ t('Loading…') }}</div>
            <table v-else-if="state.runs.length" class="w-full text-sm">
              <thead class="text-[10px] uppercase tracking-wide text-muted/60">
                <tr>
                  <th class="text-left px-4 py-2 font-medium">{{ t('When') }}</th>
                  <th class="text-right px-2 py-2 font-medium">{{ t('Pages') }}</th>
                  <th class="text-right px-2 py-2 font-medium">{{ t('Errors') }}</th>
                  <th class="text-right px-2 py-2 font-medium">{{ t('Duration') }}</th>
                  <th class="text-left px-2 py-2 font-medium">{{ t('Lang') }}</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="run in state.runs" :key="run.id"
                  class="border-t border-border/30 hover:bg-surface-soft-hover cursor-pointer"
                  @click="openRunDetail(run)"
                >
                  <td class="px-4 py-2 text-[11px] text-muted whitespace-nowrap">{{ relative(run.createdAt) }}</td>
                  <td class="px-2 py-2 text-[11px] text-right tabular-nums">{{ run.pagesChecked }}</td>
                  <td class="px-2 py-2 text-[11px] text-right tabular-nums" :class="run.totalErrors ? 'text-error' : 'text-muted/60'">{{ run.totalErrors }}</td>
                  <td class="px-2 py-2 text-[11px] text-right tabular-nums">{{ run.durationSecs ?? '—' }}s</td>
                  <td class="px-2 py-2 text-[11px] font-mono">{{ run.languageDetected ?? '—' }}</td>
                  <td class="px-4 py-2 text-right">
                    <Icon name="mdiChevronRight" :size="12" class="text-muted/60" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="px-4 py-6 text-center text-xs text-muted/60 italic">
              {{ t('No checks recorded yet for this domain.') }}
            </p>
          </div>

          <!-- Dictionary -->
          <div class="bg-surface-soft border border-border rounded-xl">
            <header class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <Icon name="mdiBookOpenVariantOutline" :size="14" class="text-muted" />
              <h4 class="text-sm font-semibold flex-1">{{ t('Dictionary') }}</h4>
              <span class="text-[10px] text-muted">{{ state.dictionary.length }}</span>
            </header>

            <div v-if="canWrite" class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <input
                v-model="newWord"
                type="text"
                :placeholder="t('New word to whitelist…')"
                class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary/60"
                @keydown.enter.prevent="onAddWord"
              />
              <label class="text-[10px] text-muted inline-flex items-center gap-1 cursor-pointer">
                <input v-model="newWordForce" type="checkbox" class="accent-primary" />
                {{ t('Force') }}
              </label>
              <BaseButton
                variant="pill" icon="mdiPlus" :icon-size="11"
                class="bg-primary! border-primary! text-black/80!"
                :disabled="!newWord.trim() || state.busy"
                @click="onAddWord"
              >{{ t('Add') }}</BaseButton>
            </div>

            <div v-if="state.loadingDomain" class="px-4 py-6 text-center text-xs text-muted">{{ t('Loading…') }}</div>
            <ul v-else-if="state.dictionary.length" class="max-h-72 overflow-y-auto divide-y divide-border/30">
              <li v-for="w in state.dictionary" :key="w.id" class="flex items-center gap-2 px-4 py-2">
                <code class="text-[11px] text-light flex-1">{{ w.word }}</code>
                <span class="text-[10px] text-muted/60">{{ w.source }}</span>
                <span class="text-[10px] text-muted/60">{{ relative(w.created_at) }}</span>
                <button
                  v-if="canWrite"
                  class="p-1 rounded hover:bg-error/10 text-error/70 hover:text-error transition-colors"
                  :title="t('Remove')"
                  @click="onRemoveWord(w)"
                >
                  <Icon name="mdiClose" :size="12" />
                </button>
              </li>
            </ul>
            <p v-else class="px-4 py-6 text-center text-xs text-muted/60 italic">{{ t('No words yet for this domain.') }}</p>
          </div>

          <!-- Ignored errors -->
          <div class="bg-surface-soft border border-border rounded-xl">
            <header class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <Icon name="mdiEyeOffOutline" :size="14" class="text-muted" />
              <h4 class="text-sm font-semibold flex-1">{{ t('Ignored errors') }}</h4>
              <span class="text-[10px] text-muted">{{ state.ignoredErrors.length }}</span>
            </header>

            <div v-if="canWrite" class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <input
                v-model="newIgnoredErr"
                type="text"
                :placeholder="t('Exact text to suppress…')"
                class="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary/60"
                @keydown.enter.prevent="onAddIgnoredError"
              />
              <BaseButton
                variant="pill" icon="mdiPlus" :icon-size="11"
                class="bg-primary! border-primary! text-black/80!"
                :disabled="!newIgnoredErr.trim() || state.busy"
                @click="onAddIgnoredError"
              >{{ t('Add') }}</BaseButton>
            </div>

            <div v-if="state.loadingDomain" class="px-4 py-6 text-center text-xs text-muted">{{ t('Loading…') }}</div>
            <ul v-else-if="state.ignoredErrors.length" class="max-h-72 overflow-y-auto divide-y divide-border/30">
              <li v-for="e in state.ignoredErrors" :key="e.id" class="flex items-center gap-2 px-4 py-2">
                <code class="text-[11px] text-light flex-1 break-all">{{ e.error_text }}</code>
                <span class="text-[10px] text-muted/60">{{ relative(e.created_at) }}</span>
                <button
                  v-if="canWrite"
                  class="p-1 rounded hover:bg-error/10 text-error/70 hover:text-error transition-colors"
                  :title="t('Remove')"
                  @click="onRemoveIgnoredError(e)"
                >
                  <Icon name="mdiClose" :size="12" />
                </button>
              </li>
            </ul>
            <p v-else class="px-4 py-6 text-center text-xs text-muted/60 italic">{{ t('No ignored errors yet for this domain.') }}</p>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>
