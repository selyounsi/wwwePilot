<script setup>
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }   from '@/composables/i18n/useI18n.js'
import { useAdminTimeline } from '@/admin/composables/useAdminTimeline.js'
import { describeItem, relativeTime } from '@/admin/composables/timelineFormat.js'

const props = defineProps({
  limit: { type: Number, default: 25 },
})

const router = useRouter()
const { t }  = useI18n()
const { state, fetchTimeline } = useAdminTimeline()

onMounted(() => {
  // Only fetch if the composable hasn't been hydrated yet (the bell may
  // have already done so). Saves a redundant round-trip on dashboard mount.
  if (!state.items.length) fetchTimeline({ limit: 50 })
})

const items = computed(() => state.items.slice(0, props.limit))

function clickItem(item) {
  const desc = describeItem(item, t)
  if (desc.route) router.push(desc.route)
}
</script>

<template>
  <section class="bg-surface-soft border border-border rounded-xl">
    <header class="px-4 py-3 border-b border-border/60 flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-sm">{{ t('Activity stream') }}</h3>
        <p class="text-[10px] text-muted/60 mt-0.5">{{ t('Logins, reports, admin actions — last 7 days') }}</p>
      </div>
      <span class="text-[10px] text-muted/60 tabular-nums">{{ items.length }} / {{ state.items.length }}</span>
    </header>

    <div v-if="state.loading && !items.length" class="px-4 py-8 text-center text-xs text-muted">
      {{ t('Loading…') }}
    </div>

    <ol v-else-if="items.length" class="divide-y divide-border/40">
      <li
        v-for="item in items" :key="item.id"
        class="px-4 py-2.5 flex items-start gap-2 transition-colors"
        :class="describeItem(item, t).route ? 'hover:bg-surface-soft-hover cursor-pointer' : ''"
        @click="clickItem(item)"
      >
        <Icon :name="describeItem(item, t).icon" :size="14" :class="[describeItem(item, t).color, 'shrink-0 mt-0.5']" />
        <div class="flex-1 min-w-0">
          <p class="text-xs leading-snug">{{ describeItem(item, t).message }}</p>
        </div>
        <span class="text-[10px] text-muted/60 tabular-nums shrink-0">{{ relativeTime(item.at, t) }}</span>
      </li>
    </ol>

    <p v-else class="px-4 py-8 text-center text-xs text-muted/60 italic">
      {{ t('No recent activity.') }}
    </p>
  </section>
</template>
