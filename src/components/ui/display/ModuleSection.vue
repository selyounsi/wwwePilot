<script setup>
import { computed, inject, ref } from 'vue'
import { useRouter }        from 'vue-router'
import { useModuleSetup }   from '@/services/web-checker/composables/useModuleSetup.js'
import { useModuleFilter }  from '@/services/web-checker/composables/useModuleFilter.js'
import { useModuleLoader }  from '@/composables/loaders/useModuleLoader.js'
import { useCheckStore }    from '@/services/web-checker/composables/useCheckStore.js'
import { useChat }          from '@/services/chatbot/composables/useChat.js'
import { useI18n }          from '@/composables/i18n/useI18n.js'

const props = defineProps({
  label:         { type: String, required: true },
  moduleId:      { type: String, default: null },
  defaultFilter: { type: String, default: 'issues' },
})

const { modules } = useModuleLoader('web-checker')
const { t }       = useI18n()
const moduleConfig = props.moduleId ? modules.find(m => m.id === props.moduleId) : null

const setup = moduleConfig
  ? useModuleSetup(
      props.moduleId,
      moduleConfig.overlay      ?? null,
      moduleConfig.allowChatBot ?? false,
    )
  : null

const overlay = setup?.moduleOverlay ?? inject('moduleOverlay', null)

const checkStore = useCheckStore()
const { filter, hasIssues, filteredResult } = useModuleFilter(setup?.result ?? null, props.defaultFilter, props.moduleId)
const rawResult = computed(() => setup?.result?.value ?? null)

const search   = ref('')
const groupBy  = ref(false)

function itemMatchesSearch(item, q) {
  if (!q) return true
  const haystack = [
    item.title, item.text, item.name, item.href, item.message, item.details, item.host,
    ...(item.issues ?? []).map(i => i.message),
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

const searchedResult = computed(() => {
  const r = filteredResult.value
  const q = search.value.trim().toLowerCase()
  if (!q && !groupBy.value) return r
  let items = r.items ?? []
  if (q) items = items.filter(i => itemMatchesSearch(i, q))
  if (groupBy.value) {
    const groups = new Map()
    items.forEach(item => {
      const key = item.issues?.[0]?.message ?? item.title ?? item.name ?? '(other)'
      if (!groups.has(key)) groups.set(key, { ...item, _groupCount: 0, _groupItems: [] })
      const g = groups.get(key)
      g._groupCount += 1
      g._groupItems.push(item)
    })
    items = Array.from(groups.values()).map(g => ({
      ...g,
      title: `${g.title ?? g.name ?? '(item)'} (${g._groupCount}×)`,
      _grouped: true,
    }))
  }
  return { ...r, items }
})

const hasOverlay    = computed(() =>
  (overlay?.hasOverlay ?? false) &&
  (setup?.result?.value?.status === 'done') &&
  (setup?.result?.value?.items?.length ?? 0) > 0
)
const overlayActive = computed(() => overlay?.overlayActive?.value ?? false)
const onText        = computed(() => t(overlay?.onText  ?? 'Hide'))
const offText       = computed(() => t(overlay?.offText ?? 'Show'))
const canRecheck    = computed(() => !!setup && setup.result?.value?.status !== 'running')
const recheckLabel  = computed(() => setup?.result?.value?.status === 'idle' ? t('Check') : t('Recheck'))

const allowChatBot = computed(() => moduleConfig?.allowChatBot ?? false)
const issueCount = computed(() => {
  const items = rawResult.value?.items ?? []
  return items.reduce((n, item) => n + (item.issues?.filter(i => i.type !== 'success').length ?? 0), 0)
})
const ignoredCount = computed(() => filteredResult.value?.ignoredCount ?? 0)

const router    = useRouter()
const { send }  = useChat()

function toggle()   { overlay?.overlayToggle?.() }
function recheck()  { setup?.recheck?.() }

function clusterInChat() {
  const r       = rawResult.value
  if (!r || !props.moduleId) return
  const items   = (r.items ?? []).filter(it => it.issues?.some(i => i.type !== 'success'))
  if (!items.length) return
  const lines = items.map((it, i) => {
    const label  = it.title || it.text || it.name || it.href || `Item ${i + 1}`
    const issues = (it.issues ?? []).filter(x => x.type !== 'success')
      .map(x => `  - [${x.type}] ${x.message}`).join('\n')
    return `**${i + 1}. ${label}**\n${issues}`
  }).join('\n\n')
  const url = checkStore.state.checkedUrl ? `\nGeprüfte URL: ${checkStore.state.checkedUrl}` : ''
  const msg = `Hier sind alle ${issueCount.value} Probleme aus dem Modul **${props.label}**:${url}\n\n${lines}\n\nBitte clustere die Probleme nach Ursache und gib mir eine priorisierte Fix-Liste — was muss ich an wenigen Stellen ändern um möglichst viele Probleme auf einmal zu fixen?`
  send(msg)
  router.push('/service/chatbot')
}
</script>

<template>
  <div class="px-4 mt-4 pb-6">
    <div class="flex items-center justify-between mb-2">
      <SectionLabel>{{ label }}</SectionLabel>
      <div class="flex items-center gap-2">
        <button
          v-if="allowChatBot && issueCount > 1"
          @click="clusterInChat"
          :title="t('Analyze all {n} issues in chat', { n: issueCount })"
          class="text-xs h-7 px-2 rounded-lg bg-surface-soft border border-border text-muted hover:bg-primary/10 hover:text-primary transition-colors shrink-0 flex items-center gap-1"
        >
          <Icon name="mdiRobot" :size="13" />
          <span class="font-medium tabular-nums">{{ issueCount }}</span>
        </button>
        <button
          v-if="canRecheck"
          @click="recheck"
          class="text-xs px-2.5 py-1.5 rounded-lg bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Icon name="mdiRefresh" :size="12" />
          {{ recheckLabel }}
        </button>
        <button
          v-if="hasOverlay"
          @click="toggle"
          class="text-xs px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
          :class="overlayActive ? 'bg-primary text-black/70 font-semibold' : 'bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover'"
        >
          {{ overlayActive ? onText : offText }}
        </button>
      </div>
    </div>

    <div v-if="hasIssues || ignoredCount > 0" class="mb-3 flex flex-col gap-2">
      <select
        v-model="filter"
        class="w-full bg-surface-soft border border-border text-muted text-xs rounded-lg px-3 py-2 outline-none focus:border-primary/50 cursor-pointer"
      >
        <option value="all">{{ t('Show all') }}</option>
        <option value="issues">{{ t('Errors & warnings') }}</option>
        <option value="errors">{{ t('Errors only') }}</option>
        <option value="warnings">{{ t('Warnings only') }}</option>
        <option v-if="ignoredCount > 0" value="ignored">{{ t('Ignored ({n})', { n: ignoredCount }) }}</option>
      </select>
    </div>

    <div v-if="(rawResult?.items?.length ?? 0) > 5" class="mb-3 flex items-center gap-2">
      <input
        v-model="search"
        type="text"
        :placeholder="t('Search items…')"
        class="flex-1 bg-surface-soft border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary/50"
      />
      <button
        @click="groupBy = !groupBy"
        :title="t('Group by rule')"
        class="text-xs px-2.5 py-2 rounded-lg transition-colors shrink-0"
        :class="groupBy ? 'bg-primary text-black/70 font-semibold' : 'bg-surface-soft border border-border text-muted hover:bg-surface-soft-hover'"
      >
        <Icon name="mdiFormatListGroup" :size="14" />
      </button>
    </div>

    <div class="flex flex-col gap-1">
      <slot :result="searchedResult" :raw="rawResult" />
    </div>
  </div>
</template>