<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { usePermissions } from '@/composables/usePermissions.js'
import { useAdminApiTokens } from '@/admin/modules/api-tokens/composables/useAdminApiTokens.js'

const { t } = useI18n()
const toast = useToast()
const { has } = usePermissions()
const { state, fetchAll, create, revoke, clearFreshToken } = useAdminApiTokens()

const canWrite = computed(() => has('admin.api-tokens.write'))

const createOpen   = ref(false)
const confirmOpen  = ref(false)
const pendingRevoke = ref(null)

onMounted(fetchAll)

async function onCreate(payload) {
  try {
    await create(payload)
    createOpen.value = false
    // state.freshToken is now set — the reveal modal opens via that
  } catch (e) { toast.error(e.message) }
}

function askRevoke(tok) {
  pendingRevoke.value = tok
  confirmOpen.value = true
}
async function confirmRevoke() {
  const tok = pendingRevoke.value
  if (!tok) return
  try {
    await revoke(tok.id)
    toast.success(t('Token revoked'))
  } catch (e) { toast.error(e.message) }
  finally { pendingRevoke.value = null }
}

function statusBadge(status) {
  switch (status) {
    case 'active':  return 'bg-success/15 text-success'
    case 'expired': return 'bg-alert/15   text-alert'
    case 'revoked': return 'bg-error/15   text-error'
    default:        return 'bg-surface    text-muted'
  }
}
function fmtDate(ts) { return ts ? new Date(ts).toLocaleString() : '—' }
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
    <header class="mb-6 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold">{{ t('API tokens') }}</h2>
        <p class="text-xs text-muted mt-0.5">
          {{ t('Long-lived bearer tokens for external integrations (CI, cron, monitoring). Each token carries a fixed permission set.') }}
        </p>
      </div>
      <BaseButton
        v-if="canWrite"
        variant="pill"
        icon="mdiPlus"
        :icon-size="13"
        class="bg-primary! border-primary! text-black/80!"
        @click="createOpen = true"
      >{{ t('New token') }}</BaseButton>
    </header>

    <div v-if="state.error" class="bg-error/10 border border-error/40 rounded-xl p-4 mb-4 text-sm text-error">{{ state.error }}</div>

    <div v-if="state.loading && !state.tokens.length" class="flex items-center justify-center py-12"><LoadingSpinner /></div>

    <div v-else class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <table v-if="state.tokens.length" class="w-full text-sm">
        <thead class="bg-surface text-[10px] uppercase tracking-wide text-muted">
          <tr>
            <th class="text-left px-4 py-2.5 font-medium">{{ t('Name') }}</th>
            <th class="text-left px-2 py-2.5 font-medium">{{ t('Prefix') }}</th>
            <th class="text-left px-2 py-2.5 font-medium">{{ t('Permissions') }}</th>
            <th class="text-left px-2 py-2.5 font-medium">{{ t('Status') }}</th>
            <th class="text-left px-2 py-2.5 font-medium">{{ t('Last used') }}</th>
            <th class="text-left px-2 py-2.5 font-medium">{{ t('Expires') }}</th>
            <th class="text-left px-2 py-2.5 font-medium">{{ t('Created') }}</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tok in state.tokens" :key="tok.id" class="border-t border-border/40">
            <td class="px-4 py-2.5 text-[11px]">{{ tok.name }}</td>
            <td class="px-2 py-2.5">
              <code class="text-[10px] text-muted font-mono">sk_{{ tok.prefix }}…</code>
            </td>
            <td class="px-2 py-2.5">
              <div class="flex flex-wrap gap-1 max-w-xs">
                <span
                  v-for="p in tok.permissions" :key="p"
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="p === '*' ? 'bg-error/15 text-error' : 'bg-primary/10 text-primary'"
                >{{ p }}</span>
              </div>
            </td>
            <td class="px-2 py-2.5">
              <span class="text-[10px] px-1.5 py-0.5 rounded" :class="statusBadge(tok.status)">{{ t(tok.status) }}</span>
            </td>
            <td class="px-2 py-2.5 text-[10px] text-muted">{{ relative(tok.lastUsedAt) }}</td>
            <td class="px-2 py-2.5 text-[10px] text-muted">{{ tok.expiresAt ? fmtDate(tok.expiresAt) : t('never') }}</td>
            <td class="px-2 py-2.5 text-[10px] text-muted">{{ relative(tok.createdAt) }}</td>
            <td class="px-4 py-2.5 text-right">
              <button
                v-if="canWrite && tok.status === 'active'"
                class="p-1.5 rounded hover:bg-error/10 text-error/70 hover:text-error transition-colors"
                :title="t('Revoke')"
                @click="askRevoke(tok)"
              >
                <Icon name="mdiKeyRemove" :size="13" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="px-4 py-8 text-center text-sm text-muted">{{ t('No tokens yet.') }}</p>
    </div>

    <ApiTokenCreateModal
      :open="createOpen"
      :busy="state.busy"
      @update:open="createOpen = $event"
      @create="onCreate"
    />

    <ApiTokenRevealModal
      :token="state.freshToken"
      @close="clearFreshToken"
    />

    <ConfirmDialog
      :open="confirmOpen"
      :title="t('Revoke this token?')"
      :message="pendingRevoke ? t('Token „{name}“ will stop working immediately. This cannot be undone.', { name: pendingRevoke.name }) : ''"
      :confirm-text="t('Revoke')"
      variant="danger"
      @update:open="confirmOpen = $event"
      @confirm="confirmRevoke"
    />
  </div>
</template>
