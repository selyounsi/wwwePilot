<script setup>
import { onMounted, computed } from 'vue'
import { useI18n }                  from '@/composables/i18n/useI18n.js'
import { useToast }                 from '@/composables/useToast.js'
import { useAdminFeatureFlags } from '@/admin/modules/flags/composables/useAdminFeatureFlags.js'
import { useAdminRoles }       from '@/admin/modules/roles/composables/useAdminRoles.js'

const { t } = useI18n()
const toast = useToast()
const { state, fetchAll, setEnabled, setRoles } = useAdminFeatureFlags()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()

onMounted(() => {
  fetchAll()
  if (!rolesState.roles.length) fetchRoles()
})

/**
 * Build a service → modules tree.
 *
 * Keys follow the convention `service.<id>` for top-level toggles and
 * `module.<service>.<sub>` for per-module switches. We pair each `service.<id>`
 * with its matching `module.<id>.*` children. Anything that doesn't follow
 * the convention lands in the "other" bucket and renders flat.
 */
const tree = computed(() => {
  const services = state.flags.filter(f => f.key.startsWith('service.'))
  const childrenByService = new Map()
  const orphans  = []

  for (const f of state.flags) {
    if (f.key.startsWith('service.')) continue
    if (f.key.startsWith('module.')) {
      // module.<service>.<sub> — group under the matching service.
      const parts = f.key.split('.')
      const svc   = parts[1]
      if (!childrenByService.has(svc)) childrenByService.set(svc, [])
      childrenByService.get(svc).push(f)
    } else {
      orphans.push(f)
    }
  }

  const nodes = services
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(svc => {
      const svcId = svc.key.replace(/^service\./, '')
      const kids  = (childrenByService.get(svcId) ?? []).sort((a, b) => a.key.localeCompare(b.key))
      return { service: svc, children: kids }
    })

  return { nodes, orphans: orphans.sort((a, b) => a.key.localeCompare(b.key)) }
})

const SERVICE_LABELS = {
  'web-checker': 'Web-checker',
  'chatbot':     'Chatbot',
}
function serviceLabel(svcId) { return SERVICE_LABELS[svcId] ?? svcId }

function childShortKey(key) {
  // module.web-checker.images → images
  return key.split('.').slice(2).join('.')
}

async function toggle(flag) {
  try {
    await setEnabled(flag.key, !flag.enabled)
    toast.success(flag.enabled
      ? t('Disabled "{key}"', { key: flag.key })
      : t('Enabled "{key}"',  { key: flag.key }))
  } catch (e) { toast.error(e.message) }
}

async function onRolesChange(flag, roles) {
  // Persist on every checkbox click — fewer round-trips than a per-row
  // save button and matches the toggle UX.
  try {
    await setRoles(flag.key, roles.length ? roles : null)
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
        {{ t('Turn services and modules on/off without releasing the extension. Per-flag role gating restricts who sees them. Changes propagate within 5 minutes.') }}
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
        v-for="node in tree.nodes" :key="node.service.key"
        class="bg-surface-soft border border-border rounded-xl"
      >
        <!-- Service header — its own toggle gates the entire group -->
        <header class="px-4 py-3 border-b border-border/60 flex items-center gap-3">
          <button
            @click="toggle(node.service)"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            :class="node.service.enabled ? 'bg-primary' : 'bg-surface border border-border'"
            role="switch"
            :aria-checked="node.service.enabled"
          >
            <span
              class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
              :class="node.service.enabled ? 'translate-x-5' : 'translate-x-0.5'"
            />
          </button>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold">{{ serviceLabel(node.service.key.replace(/^service\./, '')) }}</h3>
            <p class="text-[10px] text-muted/70">
              <code>{{ node.service.key }}</code>
              <span v-if="node.service.description" class="ml-1">— {{ node.service.description }}</span>
            </p>
          </div>
          <span class="text-[10px] text-muted hidden sm:inline">
            {{ t('{n} of {m} enabled', {
                 n: node.children.filter(c => c.enabled).length,
                 m: node.children.length,
               }) }}
          </span>
          <FlagRolePicker
            :model-value="node.service.roles ?? []"
            :roles="rolesState.roles"
            @update:model-value="onRolesChange(node.service, $event)"
          />
        </header>

        <!-- Children: indented + left-border tree connector so it's obvious
             these belong under the service. Dimmed when the parent toggle
             is off. -->
        <div
          class="pl-8"
          :class="!node.service.enabled ? 'opacity-50' : ''"
        >
          <ul class="divide-y divide-border/30 border-l border-border/60">
          <li
            v-for="child in node.children" :key="child.key"
            class="flex items-center gap-3 pl-5 pr-4 py-2.5 hover:bg-surface-soft-hover"
          >
            <button
              @click="toggle(child)"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
              :class="child.enabled ? 'bg-primary' : 'bg-surface border border-border'"
              role="switch"
              :aria-checked="child.enabled"
            >
              <span
                class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                :class="child.enabled ? 'translate-x-5' : 'translate-x-0.5'"
              />
            </button>
            <div class="flex-1 min-w-0">
              <code class="text-[11px] text-light">{{ childShortKey(child.key) }}</code>
              <p v-if="child.description" class="text-[11px] text-muted/70 mt-0.5">{{ child.description }}</p>
            </div>
            <span class="text-[10px] text-muted/60 whitespace-nowrap hidden lg:inline">{{ t('changed') }}: {{ relative(child.updatedAt) }}</span>
            <FlagRolePicker
              :model-value="child.roles ?? []"
              :roles="rolesState.roles"
              @update:model-value="onRolesChange(child, $event)"
            />
          </li>
          <li v-if="!node.children.length" class="pl-5 pr-4 py-3 text-[11px] text-muted/60 italic">
            {{ t('No sub-modules registered for this service.') }}
          </li>
          </ul>
        </div>
      </section>

      <!-- Orphans (flags that don't fit the service/module convention) -->
      <section
        v-if="tree.orphans.length"
        class="bg-surface-soft border border-border rounded-xl"
      >
        <header class="px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
          <Icon name="mdiFolderOpenOutline" :size="14" class="text-muted" />
          <h3 class="text-sm font-semibold">{{ t('Other flags') }}</h3>
        </header>
        <ul class="divide-y divide-border/30">
          <li
            v-for="f in tree.orphans" :key="f.key"
            class="flex items-center gap-3 px-4 py-2.5"
          >
            <button
              @click="toggle(f)"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
              :class="f.enabled ? 'bg-primary' : 'bg-surface border border-border'"
            >
              <span class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform" :class="f.enabled ? 'translate-x-5' : 'translate-x-0.5'" />
            </button>
            <div class="flex-1 min-w-0">
              <code class="text-[11px] text-light">{{ f.key }}</code>
              <p v-if="f.description" class="text-[11px] text-muted/70 mt-0.5">{{ f.description }}</p>
            </div>
            <FlagRolePicker
              :model-value="f.roles ?? []"
              :roles="rolesState.roles"
              @update:model-value="onRolesChange(f, $event)"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
