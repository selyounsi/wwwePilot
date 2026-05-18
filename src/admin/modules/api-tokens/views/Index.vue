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

const columns = [
  { key: 'name',        label: 'Name',        minWidth: 160, truncate: true, titleFrom: r => r.name },
  { key: 'prefix',      label: 'Prefix',      minWidth: 130 },
  { key: 'permissions', label: 'Permissions', minWidth: 240 },
  { key: 'status',      label: 'Status',      minWidth: 90 },
  { key: 'lastUsed',    label: 'Last used',   minWidth: 110 },
  { key: 'expires',     label: 'Expires',     minWidth: 150 },
  { key: 'created',     label: 'Created',     minWidth: 110 },
]
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

    <DataTable
      :rows="state.tokens"
      :columns="columns"
      :loading="state.loading"
      :error="state.error"
      :empty-text="t('No tokens yet.')"
      min-width="1100px"
    >
      <template #cell-name="{ row }">{{ row.name }}</template>
      <template #cell-prefix="{ row }">
        <code class="text-[10px] text-muted font-mono">sk_{{ row.prefix }}…</code>
      </template>
      <template #cell-permissions="{ row }">
        <div class="flex flex-wrap gap-1 max-w-xs">
          <span
            v-for="p in row.permissions" :key="p"
            class="text-[10px] px-1.5 py-0.5 rounded"
            :class="p === '*' ? 'bg-error/15 text-error' : 'bg-primary/10 text-primary'"
          >{{ p }}</span>
        </div>
      </template>
      <template #cell-status="{ row }">
        <CellBadge variant="status" :value="row.status" />
      </template>
      <template #cell-lastUsed="{ row }">
        <CellTimestamp :value="row.lastUsedAt" mode="relative" />
      </template>
      <template #cell-expires="{ row }">
        <CellTimestamp v-if="row.expiresAt" :value="row.expiresAt" mode="absolute" />
        <span v-else class="text-[10px] text-muted/60">{{ t('never') }}</span>
      </template>
      <template #cell-created="{ row }">
        <CellTimestamp :value="row.createdAt" mode="relative" />
      </template>
      <template #row-actions="{ row: tok }">
        <button
          v-if="canWrite && tok.status === 'active'"
          class="p-1.5 rounded hover:bg-error/10 text-error/70 hover:text-error transition-colors"
          :title="t('Revoke')"
          @click="askRevoke(tok)"
        >
          <Icon name="mdiKeyRemove" :size="13" />
        </button>
      </template>
    </DataTable>

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
