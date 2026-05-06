<script setup>
import { useToast } from '@/composables/useToast.js'

const { state, dismiss } = useToast()

const ICON  = { error: 'mdiAlertCircle', warning: 'mdiAlertOutline', success: 'mdiCheckCircle', info: 'mdiInformationOutline' }
const COLOR = { error: 'text-error',     warning: 'text-alert',      success: 'text-success',    info: 'text-primary'        }
const RING  = { error: 'border-error/50', warning: 'border-alert/50', success: 'border-success/50', info: 'border-border'    }
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-2 right-2 left-2 z-[60] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in state.toasts" :key="toast.id"
          class="pointer-events-auto bg-surface border rounded-xl px-3 py-2.5 flex items-start gap-2 shadow-xl"
          :class="RING[toast.type]"
        >
          <Icon :name="ICON[toast.type]" :size="14" :class="[COLOR[toast.type], 'shrink-0 mt-0.5']" />
          <div class="flex-1 min-w-0">
            <div v-if="toast.title" class="text-xs font-semibold text-light truncate">{{ toast.title }}</div>
            <div class="text-[11px] text-muted leading-snug break-words">{{ toast.message }}</div>
          </div>
          <button
            @click="dismiss(toast.id)"
            class="text-muted/40 hover:text-light shrink-0 -mr-1"
          >
            <Icon name="mdiClose" :size="12" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active { transition: all .22s cubic-bezier(.32,.72,0,1); }
.toast-enter-from   { opacity: 0; transform: translateY(-10px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
</style>
