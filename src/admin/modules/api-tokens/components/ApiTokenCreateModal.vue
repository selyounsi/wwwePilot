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

const validName = computed(() => name.value.trim().length > 0)
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
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="fixed inset-0 bg-black/60 z-50" @click="close" />
    </Transition>
    <Transition name="modal-pop">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          class="bg-background border border-border rounded-2xl w-full max-w-lg shadow-2xl pointer-events-auto flex flex-col gap-4 p-5 max-h-[85vh] overflow-y-auto"
          @click.stop
        >
          <header>
            <h3 class="text-base font-semibold">{{ t('Create API token') }}</h3>
            <p class="text-xs text-muted mt-0.5">
              {{ t('External integrations authenticate with the returned "sk_…" string. The raw token is shown ONCE — save it on creation.') }}
            </p>
          </header>

          <label class="text-[10px] uppercase tracking-wide text-muted block">
            {{ t('Name') }}
            <input
              v-model="name"
              type="text"
              :placeholder="t('e.g. CI deployment')"
              class="mt-1 w-full bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary/60"
            />
          </label>

          <label class="text-[10px] uppercase tracking-wide text-muted block">
            {{ t('Expires (optional)') }}
            <input
              v-model="expiresAt"
              type="datetime-local"
              class="mt-1 w-full bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary/60"
            />
          </label>

          <div>
            <label class="text-[10px] uppercase tracking-wide text-muted flex items-center justify-between">
              <span>{{ t('Permissions') }}</span>
              <label class="text-[10px] text-error flex items-center gap-1.5 cursor-pointer normal-case">
                <input v-model="wildcard" type="checkbox" class="accent-error" />
                {{ t('Wildcard (*) — grants everything') }}
              </label>
            </label>
            <div v-if="!wildcard" class="mt-2 max-h-60 overflow-y-auto border border-border rounded-lg bg-surface divide-y divide-border/30">
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
            <p v-else class="mt-2 text-[11px] text-error/80">
              {{ t('Wildcard tokens bypass every permission check. Use only for trusted superuser integrations.') }}
            </p>
          </div>

          <div class="flex justify-end gap-2 mt-1">
            <BaseButton variant="ghost" :disabled="busy" @click="close">{{ t('Cancel') }}</BaseButton>
            <BaseButton
              class="bg-primary! border-primary! text-black/80!"
              :disabled="!canSubmit"
              @click="submit"
            >{{ busy ? t('Creating…') : t('Create token') }}</BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity .18s ease; }
.modal-fade-enter-from, .modal-fade-leave-to       { opacity: 0; }
.modal-pop-enter-active, .modal-pop-leave-active   { transition: transform .2s cubic-bezier(.32,.72,0,1), opacity .18s ease; }
.modal-pop-enter-from, .modal-pop-leave-to         { transform: scale(.96); opacity: 0; }
</style>
