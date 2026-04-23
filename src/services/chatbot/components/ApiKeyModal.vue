<script setup>
import { ref } from 'vue'
import { useClaudeSettings } from '../composables/useClaudeSettings.js'

const emit = defineEmits(['close'])
const { keyExists, saveKey, deleteKey } = useClaudeSettings()

const input   = ref('')
const saving  = ref(false)
const masked  = ref(true)

async function save() {
  if (!input.value.trim()) return
  saving.value = true
  await saveKey(input.value.trim())
  saving.value = false
  input.value  = ''
  emit('close')
}

async function remove() {
  await deleteKey()
  emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-xs bg-surface border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-light">Claude API-Key</p>
        <button @click="$emit('close')" class="text-muted hover:text-light transition-colors">
          <Icon name="mdiClose" :size="16" />
        </button>
      </div>

      <div v-if="keyExists" class="flex flex-col gap-3">
        <div class="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-3 py-2">
          <Icon name="mdiCheck" :size="14" class="text-success shrink-0" />
          <p class="text-xs text-success">API-Key ist gespeichert</p>
        </div>
        <p class="text-xs text-muted">Möchtest du den gespeicherten Key ersetzen oder löschen?</p>
      </div>

      <div class="relative flex flex-col gap-1.5">
        <label class="text-xs text-muted">{{ keyExists ? 'Neuer API-Key' : 'API-Key eingeben' }}</label>
        <div class="flex items-center gap-1 bg-background border border-border rounded-xl px-3 py-2 focus-within:border-primary/60 transition-colors">
          <input
            v-model="input"
            :type="masked ? 'password' : 'text'"
            placeholder="sk-ant-…"
            class="flex-1 bg-transparent text-xs text-light outline-none placeholder:text-muted/40"
            @keydown.enter="save"
          />
          <button
            @click="masked = !masked"
            class="text-muted/40 hover:text-muted transition-colors shrink-0"
          >
            <Icon :name="masked ? 'mdiEye' : 'mdiEyeOff'" :size="13" />
          </button>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          @click="save"
          :disabled="!input.trim() || saving"
          class="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
          :class="input.trim() && !saving
            ? 'bg-primary text-black/70 hover:opacity-90'
            : 'bg-surface-soft text-muted/40 cursor-not-allowed'"
        >{{ saving ? 'Speichern…' : 'Speichern' }}</button>
        <button
          v-if="keyExists"
          @click="remove"
          class="px-3 py-2 rounded-xl text-xs text-error/70 hover:text-error hover:bg-error/10 border border-error/20 transition-all"
          title="Key löschen"
        >
          <Icon name="mdiTrashCan" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
