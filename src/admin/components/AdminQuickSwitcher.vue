<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useAdminSearch } from '@/admin/composables/useAdminSearch.js'

const router = useRouter()
const { t }  = useI18n()
const { state, search } = useAdminSearch()

const open       = ref(false)
const inputRef   = ref(null)
const query      = ref('')
const activeIdx  = ref(0)

// Flattened result list — easier for keyboard nav than nested groups.
const flat = computed(() => {
  const out = []
  for (const u of state.results.users   ?? []) out.push({ kind: 'user',   id: u.id,     label: userLabel(u), sub: u.email, route: { name: 'admin-user-detail', params: { id: u.id } } })
  for (const r of state.results.reports ?? []) out.push({ kind: 'report', id: r.id,     label: r.title,      sub: shortId(r.id), route: { name: 'admin-report-detail', params: { id: r.id } } })
  for (const s of state.results.sites   ?? []) out.push({ kind: 'site',   id: s.origin, label: s.origin,     sub: t('{n} runs', { n: s.run_count }), route: { name: 'admin-site-detail', params: { origin: s.origin } } })
  for (const r of state.results.runs    ?? []) out.push({ kind: 'run',    id: r.id,     label: shortId(r.id), sub: r.origin, route: { name: 'admin-run-detail', params: { id: r.id } } })
  return out
})

const KIND_ICONS = {
  user:   'mdiAccountCircleOutline',
  report: 'mdiBugOutline',
  site:   'mdiWebSync',
  run:    'mdiPlayCircleOutline',
}
const KIND_LABELS = computed(() => ({
  user:   t('User'),
  report: t('Report'),
  site:   t('Site'),
  run:    t('Run'),
}))

function shortId(id) { return String(id ?? '').slice(0, 8) }
function userLabel(u) {
  if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`
  return u.name || u.email || shortId(u.id)
}

let debounceTimer = null
watch(query, (q) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    search(q)
    activeIdx.value = 0
  }, 150)
})

function close() {
  open.value  = false
  query.value = ''
  activeIdx.value = 0
}

function go(item) {
  router.push(item.route)
  close()
}

function onKeydown(e) {
  // Cmd/Ctrl+K toggles the palette. Works globally even when focus is in an
  // input — that's the whole point of a "jump anywhere" shortcut.
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = !open.value
    if (open.value) nextTick(() => inputRef.value?.focus())
    return
  }
  if (!open.value) return
  if (e.key === 'Escape')      { e.preventDefault(); close() }
  if (e.key === 'ArrowDown')   { e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, flat.value.length - 1) }
  if (e.key === 'ArrowUp')     { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, 0) }
  if (e.key === 'Enter')       { e.preventDefault(); const it = flat.value[activeIdx.value]; if (it) go(it) }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

defineExpose({
  open: () => {
    open.value = true
    nextTick(() => inputRef.value?.focus())
  },
})
</script>

<template>
  <Teleport to="body">
    <Transition name="qs-fade">
      <div v-if="open" class="fixed inset-0 bg-black/60 z-50" @click="close" />
    </Transition>
    <Transition name="qs-pop">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 pointer-events-none"
      >
        <div
          class="bg-background border border-border rounded-2xl w-full max-w-xl shadow-2xl pointer-events-auto flex flex-col"
          @click.stop
        >
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Icon name="mdiMagnify" :size="18" class="text-muted shrink-0" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="t('Search users, reports, sites, runs…')"
              class="flex-1 bg-transparent outline-none text-sm placeholder:text-muted/60"
            />
            <span class="text-[10px] font-mono text-muted/60 shrink-0">Esc</span>
          </div>

          <div class="max-h-96 overflow-y-auto py-1">
            <p v-if="!query.trim() || query.trim().length < 2" class="px-4 py-6 text-center text-xs text-muted">
              {{ t('Type at least 2 characters to search.') }}
            </p>
            <p v-else-if="state.loading" class="px-4 py-6 text-center text-xs text-muted">{{ t('Searching…') }}</p>
            <p v-else-if="!flat.length" class="px-4 py-6 text-center text-xs text-muted">{{ t('No matches.') }}</p>
            <button
              v-for="(item, i) in flat" :key="`${item.kind}.${item.id}`"
              class="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
              :class="i === activeIdx ? 'bg-primary/15' : 'hover:bg-surface-soft-hover'"
              @mouseenter="activeIdx = i"
              @click="go(item)"
            >
              <Icon :name="KIND_ICONS[item.kind]" :size="14" class="text-muted shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ item.label }}</div>
                <div class="text-[10px] text-muted truncate">{{ item.sub }}</div>
              </div>
              <span class="text-[10px] uppercase tracking-wide text-muted/60 shrink-0">{{ KIND_LABELS[item.kind] }}</span>
            </button>
          </div>

          <div class="flex items-center justify-between gap-2 px-4 py-2 border-t border-border text-[10px] text-muted/60">
            <div class="flex items-center gap-3">
              <span><kbd class="px-1 py-0.5 bg-surface rounded">↑↓</kbd> {{ t('Navigate') }}</span>
              <span><kbd class="px-1 py-0.5 bg-surface rounded">↵</kbd> {{ t('Open') }}</span>
            </div>
            <span>{{ flat.length }} {{ t('results') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qs-fade-enter-active, .qs-fade-leave-active { transition: opacity .18s ease; }
.qs-fade-enter-from, .qs-fade-leave-to       { opacity: 0; }
.qs-pop-enter-active, .qs-pop-leave-active   { transition: transform .2s cubic-bezier(.32,.72,0,1), opacity .18s ease; }
.qs-pop-enter-from, .qs-pop-leave-to         { transform: scale(.96) translateY(-8px); opacity: 0; }
</style>
