<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useI18n }          from '@/composables/i18n/useI18n.js'

const router = useRouter()
const { services } = useServiceLoader()
const { t, lang }  = useI18n()

const open = ref(false)
function close()  { open.value = false }
function toggle() { open.value = !open.value }

function go(path) {
  close()
  router.push(path)
}
</script>

<template>
  <div class="shrink-0">
    <button
      @click="toggle"
      class="w-8 h-8 flex items-center justify-center rounded-lg bg-black/10 hover:bg-black/20 transition-colors text-black/70"
      :title="t('Menu')"
    >
      <Icon name="mdiMenu" :size="16" />
    </button>

    <Teleport to="body">
      <Transition name="qn-fade">
        <div
          v-if="open"
          class="fixed inset-0 bg-black/50 z-40"
          @click="close"
        />
      </Transition>

      <Transition name="qn-slide">
        <aside
          v-if="open"
          class="fixed top-0 right-0 bottom-0 w-72 bg-background border-l border-border z-50 flex flex-col shadow-2xl"
        >
          <div class="px-4 py-3 border-b border-border flex items-center justify-between bg-surface">
            <span class="text-sm font-semibold text-light">{{ t('Menu') }}</span>
            <button
              @click="close"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-soft-hover transition-colors text-muted"
            >
              <Icon name="mdiClose" :size="15" />
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto py-2 flex flex-col">
            <button
              @click="go('/')"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-soft-hover transition-colors text-left"
            >
              <Icon name="mdiViewDashboard" :size="15" class="text-muted shrink-0" />
              <span class="text-xs text-light flex-1">{{ t('Dashboard') }}</span>
            </button>

            <div v-if="services.length" class="mt-3 mb-1 px-4 text-[10px] uppercase tracking-wide text-muted/60">
              {{ t('Services') }}
            </div>
            <button
              v-for="s in services" :key="s.id"
              @click="go(`/service/${s.id}`)"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-soft-hover transition-colors text-left"
            >
              <Icon v-if="s.icon" :name="s.icon" :size="15" class="text-muted shrink-0" />
              <span class="text-xs text-light flex-1 truncate">{{ t(s.name) }}</span>
            </button>

            <button
              @click="go('/settings')"
              class="mt-3 flex items-center gap-3 px-4 py-2.5 hover:bg-surface-soft-hover transition-colors text-left border-t border-border/40"
            >
              <Icon name="mdiCog" :size="15" class="text-muted shrink-0" />
              <span class="text-xs text-light flex-1">{{ t('Settings') }}</span>
              <span class="text-[10px] font-mono font-semibold text-muted/80 px-1.5 py-0.5 rounded bg-surface-soft">
                {{ lang.toUpperCase() }}
              </span>
            </button>
          </nav>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.qn-fade-enter-active,
.qn-fade-leave-active { transition: opacity .18s ease; }
.qn-fade-enter-from,
.qn-fade-leave-to     { opacity: 0; }

.qn-slide-enter-active,
.qn-slide-leave-active { transition: transform .25s cubic-bezier(.32,.72,0,1); }
.qn-slide-enter-from,
.qn-slide-leave-to     { transform: translateX(100%); }
</style>
