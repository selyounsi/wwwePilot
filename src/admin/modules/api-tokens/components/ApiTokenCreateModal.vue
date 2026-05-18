<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useAdminRoles } from '@/admin/modules/roles/composables/useAdminRoles.js'

const props = defineProps({
  open:        { type: Boolean, required: true },
  busy:        { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'create'])

const { t } = useI18n()
const { state: rolesState, fetchAll: fetchRoles } = useAdminRoles()

const name        = ref('')
const expiresAt   = ref('')
const selected    = ref(new Set())
const wildcard    = ref(false)

onMounted(() => {
  if (!rolesState.permissions.length) fetchRoles()
})

watch(() => props.open, (v) => {
  if (v) {
    name.value      = ''
    expiresAt.value = ''
    selected.value  = new Set()
    wildcard.value  = false
  }
})

const validName  = computed(() => name.value.trim().length > 0)
const validPerms = computed(() => wildcard.value || selected.value.size > 0)
const canSubmit  = computed(() => validName.value && validPerms.value && !props.busy)

function togglePerm(id) {
  if (selected.value.has(id)) selected.value.delete(id)
  else                        selected.value.add(id)
  selected.value = new Set(selected.value)
}

function submit() {
  if (!canSubmit.value) return
  const perms = wildcard.value ? ['*'] : [...selected.value]
  emit('create', {
    name:      name.value.trim(),
    permissions: perms,
    expiresAt: expiresAt.value || null,
  })
}

function close() {
  if (props.busy) return
  emit('update:open', false)
}
</script>

<template>
  <BaseModal
    :open="open"
    size="lg"
    :title="t('Create API token')"
    :close-on-backdrop="!busy"
    :close-on-esc="!busy"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <p class="text-xs text-muted">
        {{ t('External integrations authenticate with the returned "sk_…" string. The raw token is shown ONCE — save it on creation.') }}
      </p>

      <FormField v-model="name" :label="t('Name')" :placeholder="t('e.g. CI deployment')" />

      <FormField v-model="expiresAt" type="datetime-local" :label="t('Expires (optional)')" />

      <div>
        <div class="text-[10px] uppercase tracking-wide text-muted/70 flex items-center justify-between mb-2">
          <span>{{ t('Permissions') }}</span>
          <CheckboxField
            v-model="wildcard"
            :label="t('Wildcard (*) — grants everything')"
            class="normal-case text-error"
          />
        </div>
        <div v-if="!wildcard" class="max-h-60 overflow-y-auto border border-border rounded-lg bg-surface divide-y divide-border/30">
          <label
            v-for="p in rolesState.permissions" :key="p.id"
            class="flex items-start gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-soft-hover transition-colors"
          >
            <input
              type="checkbox"
              :checked="selected.has(p.id)"
              class="accent-primary mt-1"
              @change="togglePerm(p.id)"
            />
            <div class="flex-1 min-w-0">
              <code class="text-[11px] text-light">{{ p.id }}</code>
              <p v-if="p.description" class="text-[10px] text-muted/70 mt-0.5">{{ p.description }}</p>
            </div>
          </label>
          <p v-if="!rolesState.permissions.length" class="px-3 py-2 text-[11px] text-muted">{{ t('Loading permissions…') }}</p>
        </div>
        <p v-else class="text-[11px] text-error/80">
          {{ t('Wildcard tokens bypass every permission check. Use only for trusted superuser integrations.') }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="ml-auto flex gap-2">
        <BaseButton variant="ghost" :disabled="busy" @click="close">{{ t('Cancel') }}</BaseButton>
        <BaseButton
          class="bg-primary! border-primary! text-black/80!"
          :disabled="!canSubmit"
          @click="submit"
        >{{ busy ? t('Creating…') : t('Create token') }}</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
