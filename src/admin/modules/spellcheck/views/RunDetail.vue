<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminSpellcheck } from '@/admin/modules/spellcheck/composables/useAdminSpellcheck.js'

const route  = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { has } = usePermissions()
const {
  state, fetchRunDetail,
  addDictionaryWord, bulkAddDictionary,
  addIgnoredError,
} = useAdminSpellcheck()

const canWrite = computed(() => has('admin.spellcheck.write'))
const slug = computed(() => String(route.params.slug ?? ''))

onMounted(() => fetchRunDetail(slug.value))
watch(slug, (s) => s && fetchRunDetail(s))

// Aggregate the flat error list into a per-page list and a frequency map.
// The frequency map drives the "Top fehler" sidebar — admins typically
// want to triage the most-repeated words first.
const detail = computed(() => state.runDetail)

const totalErrors = computed(() => detail.value?.total_errors ?? detail.value?.totalErrors ?? 0)
const pagesChecked = computed(() => detail.value?.pages_checked ?? detail.value?.pagesChecked ?? 0)

const allErrors = computed(() => {
  const results = detail.value?.errors ?? detail.value?.results ?? []
  // Detail endpoint can return either a flat `errors` array OR a `results`
  // array of `{ url, errors }` — normalize to flat with `url` attached.
  if (Array.isArray(results) && results.length && results[0]?.url && Array.isArray(results[0]?.errors)) {
    return results.flatMap(p => (p.errors ?? []).map(e => ({ ...e, page: p.url })))
  }
  return Array.isArray(results) ? results : []
})

const grouped = computed(() => {
  const counts = new Map()
  for (const e of allErrors.value) {
    const key = e.fehler ?? e.error ?? e.word ?? '?'
    const cur = counts.get(key) ?? { word: key, count: 0, category: e.bereich ?? e.category, suggestion: e.korrektur ?? e.correction }
    cur.count++
    counts.set(key, cur)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 50)
})

// Page-grouped view for the main table.
const byPage = computed(() => {
  const m = new Map()
  for (const e of allErrors.value) {
    const url = e.page ?? e.url ?? '—'
    if (!m.has(url)) m.set(url, [])
    m.get(url).push(e)
  }
  return [...m.entries()]
})

const selected = ref(new Set())   // word strings selected for bulk action
function toggleSelected(word) {
  if (selected.value.has(word)) selected.value.delete(word)
  else                          selected.value.add(word)
  selected.value = new Set(selected.value)
}
function selectAllShown() {
  selected.value = new Set(grouped.value.map(g => g.word))
}
function clearSelection() { selected.value = new Set() }

const domain = computed(() => {
  // detail returns `website_url`; fall back to extracting from any error
  const u = detail.value?.website_url ?? allErrors.value[0]?.page ?? ''
  try { return new URL(u).host } catch { return u }
})

async function addOneToDictionary(word) {
  if (!canWrite.value || !domain.value) return
  try {
    const r = await addDictionaryWord(domain.value, word)
    if (r?.rejected) toast.error(r.error ?? t('Word rejected by LanguageTool.'))
    else             toast.success(t('Added "{w}" to dictionary', { w: word }))
  } catch (e) { toast.error(e.message) }
}

async function suppressOne(word) {
  if (!canWrite.value || !domain.value) return
  try {
    await addIgnoredError(domain.value, word)
    toast.success(t('"{w}" will be suppressed in future checks', { w: word }))
  } catch (e) { toast.error(e.message) }
}

async function bulkAddSelected() {
  if (!canWrite.value || !domain.value || !selected.value.size) return
  try {
    const r = await bulkAddDictionary(domain.value, [...selected.value])
    toast.success(t('{n} of {m} words added', { n: r.ok, m: r.attempted }))
    clearSelection()
  } catch (e) { toast.error(e.message) }
}

function categoryColor(c) {
  if (c?.toLowerCase().includes('tipp')) return 'bg-error/15 text-error'
  return 'bg-alert/15 text-alert'
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-center gap-3">
      <BaseButton variant="pill" icon="mdiArrowLeft" :icon-size="13" @click="router.back()">{{ t('Back') }}</BaseButton>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold truncate">{{ t('Spellcheck run detail') }}</h2>
        <p class="text-[11px] text-muted/70 truncate">
          <code>{{ slug }}</code>
          <span v-if="domain" class="ml-2">{{ domain }}</span>
        </p>
      </div>
    </header>

    <div v-if="state.loadingDetail" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="!detail" class="bg-surface-soft border border-border rounded-xl p-6 text-center text-sm text-muted">
      {{ t('Run not found.') }}
    </div>

    <div v-else class="space-y-4">
      <!-- Summary -->
      <section class="bg-surface-soft border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Pages') }}</div>
          <div class="text-lg font-bold tabular-nums">{{ pagesChecked }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Total errors') }}</div>
          <div class="text-lg font-bold tabular-nums text-error">{{ totalErrors }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Active errors') }}</div>
          <div class="text-lg font-bold tabular-nums">{{ detail.active_errors ?? '—' }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Duration') }}</div>
          <div class="text-lg font-bold tabular-nums">{{ detail.check_duration ?? '—' }}s</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-muted/60">{{ t('Language') }}</div>
          <div class="text-sm font-mono mt-0.5">{{ detail.detected_language ?? '—' }}</div>
        </div>
      </section>

      <div class="grid grid-cols-3 gap-4">
        <!-- Top errors with bulk-action -->
        <section class="col-span-1 bg-surface-soft border border-border rounded-xl">
          <header class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Icon name="mdiFormatListNumbered" :size="14" class="text-muted" />
            <h3 class="text-sm font-semibold flex-1">{{ t('Top fehler') }}</h3>
            <span class="text-[10px] text-muted">{{ grouped.length }}</span>
          </header>

          <div v-if="canWrite" class="px-4 py-2 border-b border-border/60 flex items-center gap-2 text-[10px]">
            <button class="text-primary hover:underline" @click="selectAllShown">{{ t('Select all') }}</button>
            <button v-if="selected.size" class="text-muted hover:text-light" @click="clearSelection">
              {{ t('Clear') }} ({{ selected.size }})
            </button>
            <BaseButton
              v-if="selected.size"
              variant="pill" icon="mdiBookPlusOutline" :icon-size="11"
              class="ml-auto bg-primary! border-primary! text-black/80!"
              :disabled="state.busy"
              @click="bulkAddSelected"
            >{{ t('Add {n} to dictionary', { n: selected.size }) }}</BaseButton>
          </div>

          <ul v-if="grouped.length" class="max-h-96 overflow-y-auto divide-y divide-border/30">
            <li v-for="g in grouped" :key="g.word" class="px-4 py-2 flex items-center gap-2">
              <input
                v-if="canWrite"
                type="checkbox"
                :checked="selected.has(g.word)"
                class="accent-primary"
                @change="toggleSelected(g.word)"
              />
              <div class="flex-1 min-w-0">
                <div class="text-[11px]">
                  <code class="text-light">{{ g.word }}</code>
                  <span v-if="g.suggestion" class="text-muted ml-1">→ <code>{{ g.suggestion }}</code></span>
                </div>
                <span v-if="g.category" class="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block" :class="categoryColor(g.category)">{{ g.category }}</span>
              </div>
              <span class="text-[11px] tabular-nums text-muted shrink-0">×{{ g.count }}</span>
              <div v-if="canWrite" class="flex gap-0.5 shrink-0">
                <button
                  class="p-1 rounded hover:bg-success/10 text-success/70 hover:text-success transition-colors"
                  :title="t('Add to dictionary')"
                  @click="addOneToDictionary(g.word)"
                ><Icon name="mdiBookPlusOutline" :size="12" /></button>
                <button
                  class="p-1 rounded hover:bg-alert/10 text-alert/70 hover:text-alert transition-colors"
                  :title="t('Suppress in future checks')"
                  @click="suppressOne(g.word)"
                ><Icon name="mdiEyeOffOutline" :size="12" /></button>
              </div>
            </li>
          </ul>
          <p v-else class="px-4 py-6 text-center text-xs text-muted/60 italic">{{ t('No errors in this run.') }}</p>
        </section>

        <!-- Per-page error list -->
        <section class="col-span-2 bg-surface-soft border border-border rounded-xl">
          <header class="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Icon name="mdiFileDocumentMultipleOutline" :size="14" class="text-muted" />
            <h3 class="text-sm font-semibold flex-1">{{ t('Per page') }}</h3>
            <span class="text-[10px] text-muted">{{ byPage.length }}</span>
          </header>
          <div v-if="byPage.length" class="max-h-[60vh] overflow-y-auto divide-y divide-border/40">
            <div v-for="[url, errs] in byPage" :key="url" class="px-4 py-3">
              <div class="flex items-center gap-2 mb-2">
                <a :href="url" target="_blank" rel="noreferrer" class="text-[11px] text-primary hover:underline truncate flex-1">{{ url }}</a>
                <span class="text-[10px] text-muted/60 shrink-0">{{ t('{n} errors', { n: errs.length }) }}</span>
              </div>
              <ul class="space-y-0.5 pl-2">
                <li v-for="(e, i) in errs.slice(0, 12)" :key="i" class="text-[11px] flex items-center gap-2">
                  <code class="text-light">{{ e.fehler ?? e.error ?? '?' }}</code>
                  <span v-if="e.korrektur" class="text-muted">→ <code>{{ e.korrektur }}</code></span>
                  <span v-if="e.bereich" class="text-[9px] px-1 py-0.5 rounded ml-auto" :class="categoryColor(e.bereich)">{{ e.bereich }}</span>
                </li>
                <li v-if="errs.length > 12" class="text-[10px] text-muted/60 italic pl-2">
                  + {{ errs.length - 12 }} {{ t('more') }}
                </li>
              </ul>
            </div>
          </div>
          <p v-else class="px-4 py-6 text-center text-xs text-muted/60 italic">{{ t('No per-page data.') }}</p>
        </section>
      </div>
    </div>
  </div>
</template>
