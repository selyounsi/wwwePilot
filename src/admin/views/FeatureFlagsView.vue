<script setup>
import { onMounted, computed } from 'vue'
import { useI18n }                  from '@/composables/i18n/useI18n.js'
import { useToast }                 from '@/composables/useToast.js'
import { useAdminFeatureFlags }     from '@/admin/composables/useAdminFeatureFlags.js'

const { t } = useI18n()
const toast = useToast()
const { state, fetchAll, setEnabled } = useAdminFeatureFlags()

onMounted(fetchAll)

// Group by first dot-segment so the UI shows services and modules in
// natural buckets ("service.*" goes to one section, "module.web-checker.*"
// to another, etc.). Sorting is deterministic by key.
const grouped = computed(() => {
  const m = new Map()
  for (const f of state.flags) {
    const parts = f.key.split('.')
    const group = parts.length >= 3 ? `${parts[0]}.${parts[1]}` : parts[0]
    if (!m.has(group)) m.set(group, [])
    m.get(group).push(f)
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
})

function groupLabel(g) {
  if (g === 'service')              return t('Services (top-level)')
  if (g === 'module.web-checker')   return t('Web-checker modules')
  if (g === 'module.chatbot')       return t('Chatbot providers')
  return g
}

async function toggle(flag) {
  try {
    await setEnabled(flag.key, !flag.enabled)
    toast.success(flag.enabled
      ? t('Disabled "{key}"', { key: flag.key })
      : t('Enabled "{key}"', { key: flag.key }))
  } catch (e) { toast.error(e.message) }
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
</script>

<template>
  <div class="p-6">
    <header class="mb-6">
      <h2 class="text-xl font-bold">{{ t('Feature flags') }}</h2>
      <p class="text-xs text-muted mt-0.5">
        {{ t('Turn services and modules on/off without releasing the extension. Changes propagate within 5 minutes.') }}
      </p>
    </header>

    <div v-if="state.loading && !state.flags.length" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4">
      <p class="text-sm text-error">{{ state.error }}</p>
    </div>

    <div v-else class="space-y-6">
      <section
        v-for="[group, flags] in grouped" :key="group"
        class="bg-surface-soft border border-border rounded-xl overflow-hidden"
      >
        <header class="px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
          <Icon name="mdiFolderOpenOutline" :size="14" class="text-muted" />
          <h3 class="text-sm font-semibold">{{ groupLabel(group) }}</h3>
          <code class="text-[10px] text-muted/60 ml-1">{{ group }}.*</code>
          <span class="ml-auto text-[10px] text-muted">
            {{ t('{n} of {m} enabled', {
                 n: flags.filter(f => f.enabled).length,
                 m: flags.length,
               }) }}
          </span>
        </header>

        <table class="w-full text-sm">
          <tbody>
            <tr
              v-for="f in flags" :key="f.key"
              class="border-t border-border/30 first:border-t-0 hover:bg-surface-soft-hover"
            >
              <td class="px-4 py-3 w-12">
                <button
                  @click="toggle(f)"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  :class="f.enabled ? 'bg-primary' : 'bg-surface'"
                  role="switch"
                  :aria-checked="f.enabled"
                >
                  <span
                    class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                    :class="f.enabled ? 'translate-x-5' : 'translate-x-0.5'"
                  />
                </button>
              </td>
              <td class="px-2 py-3">
                <code class="text-[11px] text-light">{{ f.key }}</code>
                <p v-if="f.description" class="text-[11px] text-muted mt-0.5">{{ f.description }}</p>
              </td>
              <td class="px-4 py-3 text-right text-[10px] text-muted/60 whitespace-nowrap">
                {{ t('changed') }}: {{ relative(f.updatedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
