<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast.js'

const { state, dismiss } = useToast()
const route = useRoute()

const ICON  = { error: 'mdiAlertCircle', warning: 'mdiAlertOutline', success: 'mdiCheckCircle', info: 'mdiInformationOutline' }
const COLOR = { error: 'text-error',     warning: 'text-alert',      success: 'text-success',    info: 'text-primary'        }
const RING  = { error: 'border-error/50', warning: 'border-alert/50', success: 'border-success/50', info: 'border-border'    }

// The admin tab is a full browser window — full-width top toasts feel
// invasive there. Side panel keeps the original top stack since it's
// only 300-400px wide anyway.
const isAdmin = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed z-60 flex flex-col gap-2 pointer-events-none"
      :class="isAdmin
        ? 'bottom-4 right-4 items-end max-w-75'
        : 'top-2 right-2 left-2'"
    >
      <TransitionGroup :name="isAdmin ? 'toast-br' : 'toast'">
        <div
          v-for="toast in state.toasts" :key="toast.id"
          class="pointer-events-auto bg-surface border rounded-xl px-3 py-2.5 flex items-start gap-2 shadow-xl"
          :class="[
            RING[toast.type],
            isAdmin ? 'max-w-75 w-fit' : '',
          ]"
        >
          <Icon :name="ICON[toast.type]" :size="14" :class="[COLOR[toast.type], 'shrink-0 mt-0.5']" />
          <div class="flex-1 min-w-0">
            <div v-if="toast.title" class="text-xs font-semibold text-light wrap-break-word">{{ toast.title }}</div>
            <div class="text-[11px] text-muted leading-snug wrap-break-word">{{ toast.message }}</div>
          </div>
          <BaseButton
            variant="icon"
            icon="mdiClose"
            :icon-size="12"
            class="text-muted/40 hover:text-light hover:bg-transparent shrink-0 -mr-1"
            @click="dismiss(toast.id)"
          />
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

.toast-br-enter-active,
.toast-br-leave-active { transition: all .22s cubic-bezier(.32,.72,0,1); }
.toast-br-enter-from   { opacity: 0; transform: translateY(10px); }
.toast-br-leave-to     { opacity: 0; transform: translateX(20px); }
</style>
