<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const { t } = useI18n()
const toast = useToast()
const modules = ref([])
const counts  = ref(null)
const loading = ref(false)
const error   = ref(null)
const search  = ref('')

const expanded = ref(new Set())
const previewOpen = ref(false)
const previewSpec = ref(null)
const previewBusy = ref(false)
const previewCopied = ref(false)
const downloadBusy  = ref(false)

async function load() {
  loading.value = true
  error.value   = null
  try {
    const data = await apiJson(`${API.admin.url}/api-docs`)
    modules.value = data.modules ?? []
    counts.value  = data.counts  ?? null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

function toggleExpand(key) {
  if (expanded.value.has(key)) expanded.value.delete(key)
  else                          expanded.value.add(key)
  expanded.value = new Set(expanded.value)
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return modules.value
  return modules.value
    .map(m => ({
      ...m,
      routes: m.routes.filter(r =>
        r.path.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q) ||
        (r.permissions ?? []).some(p => p.toLowerCase().includes(q)),
      ),
    }))
    .filter(m => m.routes.length || m.key.toLowerCase().includes(q))
})

function methodColor(m) {
  switch (m) {
    case 'GET':    return 'bg-primary/15 text-primary'
    case 'POST':   return 'bg-success/15 text-success'
    case 'PUT':    return 'bg-alert/15 text-alert'
    case 'PATCH':  return 'bg-alert/15 text-alert'
    case 'DELETE': return 'bg-error/15 text-error'
    default:       return 'bg-surface text-muted'
  }
}

function totalRoutes(mods) {
  return mods.reduce((n, m) => n + m.routes.length, 0)
}

function annotatedRoutes(mods) {
  return mods.reduce((n, m) => n + m.routes.filter(r => r.annotated).length, 0)
}

async function fetchOpenapi() {
  return apiJson(`${API.admin.url}/api-docs/openapi.json`)
}

async function downloadOpenapi() {
  if (downloadBusy.value) return
  downloadBusy.value = true
  try {
    const spec = await fetchOpenapi()
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openapi-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast.error(t('OpenAPI download failed: {msg}', { msg: e.message }))
  } finally {
    downloadBusy.value = false
  }
}

async function viewOpenapi() {
  if (previewBusy.value) return
  previewBusy.value = true
  previewOpen.value = true
  try {
    previewSpec.value = await fetchOpenapi()
  } catch (e) {
    toast.error(t('OpenAPI fetch failed: {msg}', { msg: e.message }))
    previewOpen.value = false
  } finally {
    previewBusy.value = false
  }
}

async function copyOpenapi() {
  if (!previewSpec.value) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(previewSpec.value, null, 2))
    previewCopied.value = true
    setTimeout(() => { previewCopied.value = false }, 2000)
  } catch (e) {
    toast.error(t('Clipboard write failed — copy manually'))
  }
}

function formatSchema(s) {
  if (!s) return '—'
  return JSON.stringify(s, null, 2)
}
</script>

<template>
  <div class="p-6">
    <header class="mb-6 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold">{{ t('API docs') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Every endpoint mounted by the backend. Annotated routes carry rich schema + summary; auto-discovered routes show method + path + permission only.') }}
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <BaseButton
          variant="pill"
          icon="mdiCodeJson"
          :icon-size="13"
          :tooltip="t('Preview the full OpenAPI 3.0 spec in a modal')"
          :loading="previewBusy"
          @click="viewOpenapi"
        >{{ t('View spec') }}</BaseButton>
        <BaseButton
          variant="pill"
          icon="mdiDownload"
          :icon-size="13"
          :tooltip="t('Download openapi.json for import into Postman / Swagger UI')"
          :loading="downloadBusy"
          @click="downloadOpenapi"
        >openapi.json</BaseButton>
        <FormField
          v-model="search"
          type="search"
          prefix-icon="mdiMagnify"
          :placeholder="t('Filter by path, method, permission…')"
          class="w-72"
        />
      </div>
    </header>

    <div v-if="error" class="bg-error/10 border border-error/40 rounded-xl p-4 mb-4 text-sm text-error">{{ error }}</div>
    <div v-if="loading" class="flex items-center justify-center py-12"><LoadingSpinner /></div>

    <div v-else>
      <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-3 flex items-center gap-3">
        <span>{{ t('{m} modules · {r} routes', { m: filtered.length, r: totalRoutes(filtered) }) }}</span>
        <span class="text-success">{{ annotatedRoutes(filtered) }} {{ t('annotated') }}</span>
        <span class="text-muted">{{ totalRoutes(filtered) - annotatedRoutes(filtered) }} {{ t('reflected only') }}</span>
      </div>

      <details
        v-for="m in filtered" :key="m.key"
        open
        class="bg-surface-soft border border-border rounded-xl mb-3"
      >
        <summary class="px-4 py-3 cursor-pointer flex items-center gap-2">
          <Icon name="mdiPackageVariantClosed" :size="14" class="text-primary" />
          <h3 class="text-sm font-semibold">{{ m.key }}</h3>
          <span v-if="m.group" class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted">{{ m.group }}</span>
          <span class="ml-auto text-[10px] text-muted">{{ m.routes.length }} {{ t('routes') }}</span>
        </summary>

        <div class="border-t border-border/60 px-4 py-3 space-y-3">
          <div v-if="m.permissions.length" class="text-[11px]">
            <div class="text-[10px] uppercase tracking-wide text-muted/60 mb-1">{{ t('Permissions') }}</div>
            <ul class="space-y-0.5">
              <li v-for="p in m.permissions" :key="p.id" class="flex items-start gap-2">
                <code class="text-primary">{{ p.id }}</code>
                <span class="text-muted">— {{ p.description }}</span>
              </li>
            </ul>
          </div>

          <div v-if="m.mount?.api || m.mount?.adminApi" class="text-[10px] text-muted">
            <span v-if="m.mount?.api">
              <strong class="text-muted/80">api:</strong> <code>{{ m.mount.api }}</code>
            </span>
            <span v-if="m.mount?.api && m.mount?.adminApi" class="mx-2">·</span>
            <span v-if="m.mount?.adminApi">
              <strong class="text-muted/80">adminApi:</strong> <code>/api/admin{{ m.mount.adminApi }}</code>
            </span>
          </div>

          <ul v-if="m.routes.length" class="space-y-1">
            <li
              v-for="r in m.routes" :key="`${r.method}-${r.path}`"
              class="border-t border-border/30 first:border-t-0 pt-1.5"
            >
              <button
                class="w-full flex items-center gap-2 text-[11px] py-1 text-left hover:bg-surface-soft-hover transition-colors rounded"
                @click="r.annotated && toggleExpand(`${r.method}-${r.path}`)"
              >
                <span class="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded w-14 text-center" :class="methodColor(r.method)">
                  {{ r.method }}
                </span>
                <code class="text-light flex-1 break-all">{{ r.path }}</code>
                <span v-if="r.summary" class="text-[10px] text-muted truncate max-w-72">{{ r.summary }}</span>
                <span v-if="r.scope === 'admin'" class="text-[10px] px-1.5 py-0.5 rounded bg-alert/15 text-alert">admin</span>
                <span v-for="p in r.permissions" :key="p" class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{{ p }}</span>
                <span v-if="r.annotated" class="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success" :title="t('Annotated with Zod schemas')">✓</span>
                <Icon v-if="r.annotated" :name="expanded.has(`${r.method}-${r.path}`) ? 'mdiChevronUp' : 'mdiChevronDown'" :size="12" class="text-muted/60" />
              </button>

              <div
                v-if="r.annotated && expanded.has(`${r.method}-${r.path}`)"
                class="mt-2 ml-16 mb-2 space-y-2 text-[11px]"
              >
                <div v-if="r.description" class="text-muted">{{ r.description }}</div>
                <div v-if="r.tags?.length" class="flex flex-wrap gap-1">
                  <span v-for="tag in r.tags" :key="tag" class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted">#{{ tag }}</span>
                </div>

                <details v-if="r.body" class="bg-surface rounded p-2">
                  <summary class="cursor-pointer text-[10px] uppercase tracking-wide text-muted">{{ t('Request body') }}</summary>
                  <pre class="text-[10px] mt-2 overflow-x-auto"><code>{{ formatSchema(r.body) }}</code></pre>
                </details>

                <details v-if="r.query" class="bg-surface rounded p-2">
                  <summary class="cursor-pointer text-[10px] uppercase tracking-wide text-muted">{{ t('Query params') }}</summary>
                  <pre class="text-[10px] mt-2 overflow-x-auto"><code>{{ formatSchema(r.query) }}</code></pre>
                </details>

                <div v-if="r.responses">
                  <div class="text-[10px] uppercase tracking-wide text-muted">{{ t('Responses') }}</div>
                  <details v-for="(resp, status) in r.responses" :key="status" class="bg-surface rounded p-2 mt-1">
                    <summary class="cursor-pointer flex items-center gap-2">
                      <span class="text-[10px] px-1.5 py-0.5 rounded font-mono" :class="String(status).startsWith('2') ? 'bg-success/15 text-success' : 'bg-error/15 text-error'">{{ status }}</span>
                      <span class="text-[10px] text-muted">{{ resp.description }}</span>
                    </summary>
                    <pre v-if="resp.schema" class="text-[10px] mt-2 overflow-x-auto"><code>{{ formatSchema(resp.schema) }}</code></pre>
                  </details>
                </div>
              </div>
            </li>
          </ul>
          <p v-else class="text-[11px] text-muted/60 italic">{{ t('No routes detected.') }}</p>
        </div>
      </details>

      <p v-if="!filtered.length" class="text-center text-sm text-muted py-8 italic">{{ t('No matches.') }}</p>
    </div>

    <BaseModal :open="previewOpen" size="xl" :title="t('OpenAPI 3.0 spec')" @update:open="previewOpen = $event">
      <template #actions>
        <BaseButton
          variant="pill"
          :icon="previewCopied ? 'mdiCheck' : 'mdiContentCopy'"
          :icon-size="13"
          :class="previewCopied && 'bg-success! border-success! text-black/80!'"
          :disabled="!previewSpec"
          @click="copyOpenapi"
        >{{ previewCopied ? t('Copied') : t('Copy') }}</BaseButton>
        <BaseButton
          variant="pill"
          icon="mdiDownload"
          :icon-size="13"
          :disabled="!previewSpec || downloadBusy"
          @click="downloadOpenapi"
        >openapi.json</BaseButton>
      </template>

      <div v-if="previewBusy" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
      <pre v-else-if="previewSpec" class="text-[11px] font-mono bg-surface rounded-lg p-3 overflow-x-auto leading-relaxed">{{ JSON.stringify(previewSpec, null, 2) }}</pre>
    </BaseModal>
  </div>
</template>
