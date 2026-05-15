<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

const props = defineProps({
  /** Currently restricted role IDs. `null` / `[]` = no restriction. */
  modelValue: { type: Array, default: null },
  /** Catalog of available roles: `[{ id, name }, ...]`. */
  roles:      { type: Array, required: true },
  /** Disable the button (e.g. while a save is in-flight). */
  disabled:   { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const open = ref(false)
const rootRef = ref(null)

// Internal copy so users can stage multiple toggles before the popover
// commits. Bidirectional sync with modelValue.
const selected = ref(new Set(props.modelValue ?? []))

const everyone = computed(() => selected.value.size === 0)
const buttonLabel = computed(() => {
  if (everyone.value) return t('All roles')
  if (selected.value.size === 1) {
    const id = [...selected.value][0]
    return props.roles.find(r => r.id === id)?.name ?? id
  }
  return t('{n} roles', { n: selected.value.size })
})

function toggle(roleId) {
  if (selected.value.has(roleId)) selected.value.delete(roleId)
  else                            selected.value.add(roleId)
  // Set assignment to trigger reactivity.
  selected.value = new Set(selected.value)
  emit('update:modelValue', [...selected.value])
}

function clearAll() {
  selected.value = new Set()
  emit('update:modelValue', [])
}

function onWindowClick(e) {
  if (!open.value) return
  if (!rootRef.value?.contains(e.target)) open.value = false
}
onMounted(() => window.addEventListener('click', onWindowClick))
onBeforeUnmount(() => window.removeEventListener('click', onWindowClick))
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      :disabled="disabled"
      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] border transition-colors disabled:opacity-50"
      :class="everyone
        ? 'border-border text-muted hover:bg-surface-soft-hover'
        : 'border-primary/40 text-primary bg-primary/10 hover:bg-primary/15'"
      @click="open = !open"
    >
      <Icon :name="everyone ? 'mdiAccountMultipleOutline' : 'mdiAccountKeyOutline'" :size="11" />
      <span>{{ buttonLabel }}</span>
      <Icon name="mdiChevronDown" :size="11" class="opacity-60" />
    </button>

    <Transition name="rp-drop">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-1 w-56 max-w-[calc(100vw-1rem)] bg-background border border-border rounded-lg shadow-xl z-40"
      >
        <header class="px-3 py-2 border-b border-border/60 flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('Restrict to roles') }}</span>
          <button
            v-if="!everyone"
            class="text-[10px] text-primary hover:underline"
            @click="clearAll"
          >{{ t('All roles') }}</button>
        </header>
        <div class="py-1 max-h-60 overflow-y-auto">
          <p v-if="!roles.length" class="px-3 py-2 text-[11px] text-muted">{{ t('No roles loaded.') }}</p>
          <label
            v-for="r in roles" :key="r.id"
            class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-soft-hover transition-colors"
          >
            <input
              type="checkbox"
              :checked="selected.has(r.id)"
              class="accent-primary"
              @change="toggle(r.id)"
            />
            <span class="text-xs flex-1 truncate">{{ r.name }}</span>
            <code class="text-[10px] text-muted/60">{{ r.id }}</code>
          </label>
        </div>
        <p class="px-3 py-2 border-t border-border/60 text-[10px] text-muted leading-snug">
          {{ everyone
              ? t('Flag applies to everyone.')
              : t('Flag only counts as enabled for users with one of these roles.') }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rp-drop-enter-active, .rp-drop-leave-active { transition: transform .15s ease, opacity .12s ease; }
.rp-drop-enter-from, .rp-drop-leave-to       { transform: translateY(-4px); opacity: 0; }
</style>
