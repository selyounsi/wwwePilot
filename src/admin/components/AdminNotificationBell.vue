<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useAdminTimeline } from '@/admin/composables/useAdminTimeline.js'
import { describeItem, relativeTime } from '@/admin/composables/timelineFormat.js'

const router = useRouter()
const { t }  = useI18n()
const { state, unread, fetchTimeline, markAllRead } = useAdminTimeline()

const open = ref(false)
let pollTimer = null

onMounted(() => {
  fetchTimeline({ limit: 50 })
  // Same cadence as the reports-counts poll — cheap query, picks up new
  // events within a minute without thrashing the DB.
  pollTimer = setInterval(() => fetchTimeline({ limit: 50 }), 60_000)
  window.addEventListener('click', onWindowClick)
})
onBeforeUnmount(() => {
  clearInterval(pollTimer)
  window.removeEventListener('click', onWindowClick)
})

function onWindowClick(e) {
  if (!open.value) return
  // Close on outside click. The bell button stops propagation so its own
  // click doesn't trigger this.
  if (!e.target.closest('[data-bell-root]')) open.value = false
}

const badgeCount = computed(() => Math.min(unread.value.length, 99))
const items = computed(() => state.items.slice(0, 20))

function toggle(e) {
  e.stopPropagation()
  open.value = !open.value
  if (open.value) {
    // Mark read as soon as the drawer opens — same UX as Slack / GitHub.
    setTimeout(() => markAllRead(), 50)
  }
}

function clickItem(item) {
  const desc = describeItem(item, t)
  if (desc.route) router.push(desc.route)
  open.value = false
}
</script>

<template>
  <div data-bell-root class="relative">
    <button
      class="relative p-1.5 rounded-lg hover:bg-surface-soft-hover transition-colors"
      :title="t('Notifications')"
      @click="toggle"
    >
      <Icon name="mdiBellOutline" :size="18" class="text-light" />
      <span
        v-if="badgeCount > 0"
        class="absolute -top-0.5 -right-0.5 text-[9px] font-semibold tabular-nums bg-error text-white rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
      >{{ badgeCount }}</span>
    </button>

    <Transition name="bell-drop">
      <div
        v-if="open"
        class="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-background border border-border rounded-xl shadow-2xl z-50 flex flex-col"
      >
        <header class="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <h3 class="text-xs font-semibold">{{ t('Notifications') }}</h3>
          <button
            v-if="items.length"
            class="text-[10px] text-muted hover:text-light"
            @click.stop="markAllRead"
          >{{ t('Mark all read') }}</button>
        </header>

        <div class="max-h-96 overflow-y-auto">
          <p v-if="state.loading && !items.length" class="px-4 py-6 text-center text-xs text-muted">
            {{ t('Loading…') }}
          </p>
          <p v-else-if="!items.length" class="px-4 py-6 text-center text-xs text-muted">
            {{ t('Nothing new — go enjoy your coffee.') }}
          </p>

          <button
            v-for="item in items" :key="item.id"
            class="w-full flex items-start gap-2 px-4 py-2 text-left hover:bg-surface-soft-hover transition-colors"
            :class="item.at > state.lastReadAt ? 'bg-primary/5' : ''"
            @click="clickItem(item)"
          >
            <Icon :name="describeItem(item, t).icon" :size="14" :class="[describeItem(item, t).color, 'shrink-0 mt-0.5']" />
            <div class="flex-1 min-w-0">
              <p class="text-[11px] leading-snug">{{ describeItem(item, t).message }}</p>
              <p class="text-[10px] text-muted/60 mt-0.5">{{ relativeTime(item.at, t) }}</p>
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell-drop-enter-active, .bell-drop-leave-active { transition: transform .18s cubic-bezier(.32,.72,0,1), opacity .15s ease; }
.bell-drop-enter-from, .bell-drop-leave-to       { transform: translateY(-6px) scale(.98); opacity: 0; }
</style>
