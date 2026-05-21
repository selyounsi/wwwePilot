<script setup>
import { computed, watch, ref } from 'vue'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useToast }        from '@/composables/useToast.js'
import { usePageDetector } from '@/composables/usePageDetector.js'
import { usePageMeta }     from '@/composables/usePageMeta.js'
import { useDiscovery }    from '@/composables/useDiscovery.js'
import { useFeatureFlags } from '@/composables/useFeatureFlags.js'
import { useQuickLinks }   from '@/services/quick-info/composables/useQuickLinks.js'
import MetaRow             from '@/services/quick-info/components/MetaRow.vue'

const props = defineProps({
  tabId:  { type: [Number, String], default: null },
  tabUrl: { type: String, default: '' },
})

const { t } = useI18n()
const toast = useToast()
const { state: detectorState, detect, cmsLabel } = usePageDetector()
const { state: metaState, extract: extractMeta } = usePageMeta()
const { state: discoveryState, inspect: inspectDiscovery } = useDiscovery()
const { isEnabled }   = useFeatureFlags()
const { state: linksState, fetchLinks, resolve: resolveLink } = useQuickLinks()

const quickLinksEnabled = computed(() => isEnabled('module.quick-info.quick-links'))

const showSignals = ref(false)

watch(() => [props.tabId, props.tabUrl], async () => {
  if (props.tabId && props.tabUrl) {
    detect({ tabId: props.tabId, url: props.tabUrl }).catch(e => console.warn('[quick-info] detection failed', e))
    extractMeta({ tabId: props.tabId, url: props.tabUrl }).catch(e => console.warn('[quick-info] meta extraction failed', e))
    inspectDiscovery({ url: props.tabUrl }).catch(e => console.warn('[quick-info] discovery failed', e))
  }
}, { immediate: true })

// Re-fetch links whenever the detector resolves the CMS (so the server-side
// page-type filter narrows correctly). Detector runs in parallel with us,
// so we wait for the actual cms to land before asking the backend.
watch(() => detectorState.cms, (cms) => {
  if (cms && quickLinksEnabled.value) {
    fetchLinks(cms).catch(e => console.warn('[quick-info] quick-links failed', e))
  }
})

const cmsTone = computed(() => {
  switch (detectorState.cms) {
    case 'cms3':      return 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    case 'cms4':      return 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    case 'everpress': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'wordpress': return 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    case 'unknown':   return 'bg-muted/15 text-muted border-muted/30'
    default:          return 'bg-muted/10 text-muted/70 border-muted/20'
  }
})

const origin = computed(() => {
  try { return new URL(detectorState.url ?? props.tabUrl).origin } catch { return '' }
})

const path = computed(() => {
  try {
    const u = new URL(detectorState.url ?? props.tabUrl)
    return (u.pathname + u.search) || '/'
  } catch { return '' }
})

const activeMarkers = computed(() => {
  const m = detectorState.signals?.markers ?? {}
  return Object.entries(m).filter(([, v]) => v).map(([k]) => k)
})

const versionAttrs = computed(() => {
  const v = detectorState.signals?.versionAttrs ?? {}
  return Object.entries(v).filter(([, val]) => val)
})

const isHttps = computed(() => metaState.tech?.protocol === 'https')

const robotsTxtSummary = computed(() => {
  if (!discoveryState.robots) return null
  const s = discoveryState.robots.status
  if (s === 200) return `✓ ${t('Found')}`
  if (!s)        return null
  return `✗ ${t('Not found')} (${s})`
})

async function copyText(value) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(String(value))
    toast.success(t('Copied'))
  } catch (e) { toast.error(e.message) }
}

function resolveCtx() {
  return {
    url:       props.tabUrl,
    counterId: detectorState.counterId,
    cms:       detectorState.cms,
  }
}

// Pre-filter links whose template references a placeholder we can't fill
// for the current tab (e.g. <liveDomain> outside demo hosts). Re-runs
// whenever the active URL changes so navigating between demo + live hosts
// keeps the list in sync.
const visibleLinks = computed(() => {
  return linksState.links
    .map(link => ({ link, resolved: resolveLink(link.urlTemplate, resolveCtx()) }))
    .filter(x => x.resolved)
})

function openQuickLink(link) {
  const resolved = resolveLink(link.urlTemplate, resolveCtx())
  if (!resolved) return
  chrome.tabs.create({ url: resolved })
}

async function runProbe() {
  if (!props.tabId || !props.tabUrl) return
  try {
    await detect({ tabId: props.tabId, url: props.tabUrl, probe: true, force: true })
    toast.success(t('Probe finished'))
  } catch (e) { toast.error(e.message) }
}

function openLink(href) {
  if (!href) return
  chrome.tabs.create({ url: href })
}

defineExpose({
  refresh: async () => {
    await Promise.all([
      detect({ tabId: props.tabId, url: props.tabUrl, force: true }),
      extractMeta({ tabId: props.tabId, url: props.tabUrl, force: true }),
      inspectDiscovery({ url: props.tabUrl, force: true }),
    ])
  },
})
</script>

<template>
  <div class="space-y-3">
    <div class="px-1">
      <div class="text-xs font-semibold">{{ t('Quick Page Info') }}</div>
      <div class="text-[10px] text-muted/70 mt-0.5">
        {{ t('No profile configured for this URL — showing page detection.') }}
      </div>
    </div>

    <!-- Detected page -->
    <section>
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('Detected page') }}</h3>
      <BaseCard padding="sm">
        <div v-if="detectorState.loading" class="text-[10px] text-muted/60 italic">
          {{ t('Detecting…') }}
        </div>
        <div v-else-if="detectorState.error" class="text-[10px] text-error">
          {{ detectorState.error }}
        </div>
        <div v-else>
          <div class="flex items-center flex-wrap gap-2">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold"
              :class="cmsTone"
            >
              {{ t(cmsLabel(detectorState.cms)) }}
            </span>
            <span v-if="detectorState.version" class="text-xs text-muted">
              v{{ detectorState.version }}
            </span>
          </div>
          <div v-if="detectorState.counterId" class="flex items-center gap-1.5 mt-2 min-w-0">
            <span class="text-[10px] uppercase tracking-wide text-muted/60 shrink-0">{{ t('Counter ID') }}:</span>
            <code class="text-[11px] text-muted truncate font-mono" :title="detectorState.counterId">{{ detectorState.counterId }}</code>
            <BaseButton
              variant="icon"
              icon="mdiContentCopy"
              :icon-size="12"
              :tooltip="t('Copy')"
              @click="copyText(detectorState.counterId)"
            />
          </div>
          <div v-if="detectorState.generator" class="text-[10px] text-muted/80 mt-1.5 truncate" :title="detectorState.generator">
            <span class="uppercase tracking-wide text-muted/60">{{ t('Generator') }}:</span>
            {{ detectorState.generator }}
          </div>
        </div>
      </BaseCard>
    </section>

    <!-- URL -->
    <section>
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('URL') }}</h3>
      <BaseCard padding="sm">
        <MetaRow :label="t('Origin')" :value="origin" copyable />
        <MetaRow :label="t('Path')"   :value="path"   copyable />
      </BaseCard>
    </section>

    <!-- Quick Links (admin-defined, CMS-filtered, placeholder-aware) -->
    <section v-if="quickLinksEnabled && visibleLinks.length">
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('Quick links') }}</h3>
      <BaseCard padding="sm">
        <div class="space-y-1">
          <button
            v-for="{ link } in visibleLinks"
            :key="link.id"
            type="button"
            class="w-full flex items-center gap-2 text-left rounded-md hover:bg-muted/10 px-1.5 py-1.5 transition-colors"
            @click="openQuickLink(link)"
          >
            <Icon :name="link.icon || 'mdiOpenInNew'" :size="14" class="text-primary shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium truncate">{{ link.label }}</div>
              <div v-if="link.description" class="text-[10px] text-muted/70 truncate">{{ link.description }}</div>
            </div>
            <Icon name="mdiChevronRight" :size="14" class="text-muted/60 shrink-0" />
          </button>
        </div>
      </BaseCard>
    </section>

    <!-- SEO meta -->
    <section>
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('SEO meta') }}</h3>
      <BaseCard padding="sm">
        <div v-if="metaState.loading && !metaState.seo" class="text-[10px] text-muted/60 italic">
          {{ t('Reading…') }}
        </div>
        <template v-else-if="metaState.seo">
          <MetaRow :label="t('Title')"       :value="metaState.seo.title"       copyable />
          <MetaRow :label="t('Description')" :value="metaState.seo.description" copyable />
          <MetaRow :label="t('Language')"    :value="metaState.seo.language"    :expandable="false" />
          <MetaRow :label="t('Meta robots')" :value="metaState.seo.robots || t('(none — defaults apply)')" :expandable="false" />
          <MetaRow :label="t('robots.txt')"  :value="robotsTxtSummary"                                    :expandable="false" />
          <MetaRow :label="t('Canonical')"   :value="metaState.seo.canonical"   :href="metaState.seo.canonical" copyable openable />
        </template>
      </BaseCard>
    </section>

    <!-- Tech indicators -->
    <section>
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('Tech indicators') }}</h3>
      <BaseCard padding="sm">
        <div v-if="metaState.loading && !metaState.tech" class="text-[10px] text-muted/60 italic">
          {{ t('Reading…') }}
        </div>
        <template v-else-if="metaState.tech">
          <div class="flex items-center gap-2 flex-wrap pb-1.5">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium"
              :class="isHttps
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'"
            >
              <Icon :name="isHttps ? 'mdiLockOutline' : 'mdiLockOpenOutline'" :size="11" />
              {{ (metaState.tech.protocol ?? '').toUpperCase() }}
            </span>
            <span v-if="metaState.tech.charset" class="text-[10px] text-muted">
              {{ metaState.tech.charset }}
            </span>
          </div>
          <MetaRow :label="t('Viewport')" :value="metaState.tech.viewport" />
          <MetaRow
            :label="t('Favicon')"
            :value="metaState.tech.favicon"
            :href="metaState.tech.favicon"
            openable
          >
            <template v-if="metaState.tech.favicon">
              <img :src="metaState.tech.favicon" class="w-3 h-3 inline-block mr-1 align-text-bottom" loading="lazy" />
            </template>
          </MetaRow>
        </template>
      </BaseCard>
    </section>

    <!-- Structure (compact 6-col stats) -->
    <section>
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('Structure') }}</h3>
      <BaseCard padding="sm">
        <div v-if="metaState.loading && !metaState.stats" class="text-[10px] text-muted/60 italic">
          {{ t('Counting…') }}
        </div>
        <div v-else-if="metaState.stats" class="grid grid-cols-3 gap-2">
          <div v-for="stat in [
            { label: t('H1'),     value: metaState.stats.h1     },
            { label: t('H2'),     value: metaState.stats.h2     },
            { label: t('H3'),     value: metaState.stats.h3     },
            { label: t('Images'), value: metaState.stats.images },
            { label: t('Links'),  value: metaState.stats.links  },
            { label: t('Forms'),  value: metaState.stats.forms  },
          ]" :key="stat.label" class="text-center bg-muted/10 rounded-md py-2 px-1">
            <div class="text-base font-bold leading-tight">{{ stat.value }}</div>
            <div class="text-[10px] text-muted/70 uppercase tracking-wide mt-0.5">{{ stat.label }}</div>
          </div>
        </div>
      </BaseCard>
    </section>

    <!-- Discovery -->
    <section>
      <h3 class="text-[10px] uppercase tracking-wide text-muted/70 px-1 mb-1 font-medium">{{ t('Discovery') }}</h3>
      <BaseCard padding="sm">
        <div v-if="discoveryState.loading && !discoveryState.robots && !discoveryState.sitemap" class="text-[10px] text-muted/60 italic">
          {{ t('Fetching robots.txt + sitemap.xml…') }}
        </div>
        <div v-else class="space-y-2.5">
          <!-- robots.txt -->
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] text-muted/70 font-medium">robots.txt</span>
              <span
                v-if="discoveryState.robots?.status === 200"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              >200</span>
              <span
                v-else
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30"
              >{{ discoveryState.robots?.status || '—' }}</span>

              <span
                v-if="discoveryState.robots?.status === 200"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border"
                :class="discoveryState.robots.allowed
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'"
              >
                <Icon :name="discoveryState.robots.allowed ? 'mdiCheckCircleOutline' : 'mdiCancel'" :size="10" />
                {{ discoveryState.robots.allowed ? t('Allowed') : t('Blocked') }}
              </span>

              <span v-if="discoveryState.robots?.crawlDelay" class="text-[9px] text-muted">
                {{ t('Crawl-delay') }}: {{ discoveryState.robots.crawlDelay }}s
              </span>

              <BaseButton
                v-if="discoveryState.origin"
                variant="icon"
                icon="mdiOpenInNew"
                :icon-size="12"
                :tooltip="t('Open')"
                class="ml-auto"
                @click="openLink(`${discoveryState.origin}/robots.txt`)"
              />
            </div>
            <div v-if="discoveryState.robots?.matchedRule" class="text-[9px] text-muted/70 truncate" :title="discoveryState.robots.matchedRule">
              <code>{{ discoveryState.robots.matchedRule }}</code>
            </div>
          </div>

          <div class="h-px bg-border/40" />

          <!-- sitemap.xml -->
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] text-muted/70 font-medium">sitemap.xml</span>
              <span
                v-if="discoveryState.sitemap?.status === 200"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              >200</span>
              <span
                v-else
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30"
              >{{ discoveryState.sitemap?.status || '—' }}</span>

              <span
                v-if="discoveryState.sitemap?.isIndex"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-violet-500/15 text-violet-300 border border-violet-500/30"
              >{{ t('Index') }}</span>

              <span
                v-if="discoveryState.sitemap && discoveryState.sitemap.urlCount > 0"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-muted/15 text-muted border border-muted/30"
              >{{ discoveryState.sitemap.urlCount }} URLs</span>

              <BaseButton
                v-if="discoveryState.sitemap?.url"
                variant="icon"
                icon="mdiOpenInNew"
                :icon-size="12"
                :tooltip="t('Open')"
                class="ml-auto"
                @click="openLink(discoveryState.sitemap.url)"
              />
            </div>

            <div
              v-if="discoveryState.sitemap?.status === 200 && discoveryState.sitemap.urls.length"
              class="text-[10px]"
            >
              <span
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium border"
                :class="discoveryState.sitemap.inSitemap
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'"
              >
                <Icon :name="discoveryState.sitemap.inSitemap ? 'mdiCheckCircleOutline' : 'mdiCancel'" :size="10" />
                {{ discoveryState.sitemap.inSitemap ? t('In sitemap') : t('Not in sitemap') }}
              </span>
            </div>

            <div v-if="discoveryState.sitemap?.lastMod" class="text-[9px] text-muted/70">
              {{ t('Last update') }}: {{ discoveryState.sitemap.lastMod }}
            </div>
          </div>
        </div>
      </BaseCard>
    </section>

    <!-- Detection signals (collapsible) -->
    <section>
      <div class="flex items-center justify-between px-1 mb-1">
        <h3 class="text-[10px] uppercase tracking-wide text-muted/70 font-medium">{{ t('Detection signals') }}</h3>
        <button
          type="button"
          class="text-[10px] text-muted/70 hover:text-primary"
          @click="showSignals = !showSignals"
        >
          {{ showSignals ? t('Hide') : t('Show') }}
        </button>
      </div>
      <BaseCard v-if="showSignals" padding="sm">
        <div class="space-y-2 text-[10px]">
          <div>
            <div class="text-muted/60 uppercase tracking-wide mb-1 text-[9px]">{{ t('Active markers') }}</div>
            <div v-if="activeMarkers.length" class="flex flex-wrap gap-1">
              <span
                v-for="m in activeMarkers"
                :key="m"
                class="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/20 text-muted border border-border/40 text-[9px]"
              >{{ m }}</span>
            </div>
            <div v-else class="text-muted/40 italic text-[9px]">{{ t('No script markers detected') }}</div>
          </div>

          <div v-if="versionAttrs.length">
            <div class="text-muted/60 uppercase tracking-wide mb-1 text-[9px]">{{ t('Version attributes') }}</div>
            <div class="space-y-0.5 text-[9px]">
              <div v-for="[k, v] in versionAttrs" :key="k" class="wrap-break-word">
                <span class="text-muted/70">{{ k }}=</span>
                <span class="text-foreground">{{ v }}</span>
              </div>
            </div>
          </div>

          <div v-if="detectorState.signals?.probe">
            <div class="text-muted/60 uppercase tracking-wide mb-1 text-[9px]">{{ t('Network probe') }}</div>
            <div class="space-y-0.5 text-[9px]">
              <div>our: {{ detectorState.signals.probe.our ? '✓' : '·' }}</div>
              <div>cms3: {{ detectorState.signals.probe.cms3 ? '✓' : '·' }}</div>
              <div>cms4: {{ detectorState.signals.probe.cms4 ? '✓' : '·' }}</div>
            </div>
          </div>

          <div class="pt-0.5">
            <BaseButton
              variant="secondary"
              :disabled="detectorState.loading"
              @click="runProbe"
            >
              {{ t('Run network probe') }}
            </BaseButton>
          </div>
        </div>
      </BaseCard>
    </section>
  </div>
</template>
