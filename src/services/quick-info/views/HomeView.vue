<script setup>
import { computed, ref, onMounted } from 'vue'
import { useI18n }         from '@/composables/i18n/useI18n.js'
import { useToast }        from '@/composables/useToast.js'
import { useActiveTab }    from '@/composables/useActiveTab.js'
import { useFeatureFlags } from '@/composables/useFeatureFlags.js'
import { useQuickInfoProfiles } from '@/services/quick-info/composables/useQuickInfoProfiles.js'
import ProfileInfoView from '@/services/quick-info/views/ProfileInfoView.vue'
import PageInfoView    from '@/services/quick-info/views/PageInfoView.vue'

const { t }    = useI18n()
const toast    = useToast()
const { tabId, tabUrl } = useActiveTab()
const { isEnabled } = useFeatureFlags()
const { state: profilesState, fetchProfiles, matchProfile } = useQuickInfoProfiles()

const profileEnabled  = computed(() => isEnabled('module.quick-info.profile'))
const detectorEnabled = computed(() => isEnabled('module.quick-info.detector'))

// pinned = frozen snapshot of tab id + url, tab switches stop propagating
const pinned    = ref(false)
const frozenTab = ref({ id: null, url: '' })

const effTabId  = computed(() => pinned.value ? frozenTab.value.id  : tabId.value)
const effTabUrl = computed(() => pinned.value ? frozenTab.value.url : tabUrl.value)

const pinnedHost = computed(() => {
  try { return pinned.value ? new URL(frozenTab.value.url).host : '' } catch { return '' }
})

function togglePin() {
  if (!pinned.value) frozenTab.value = { id: tabId.value, url: tabUrl.value }
  pinned.value = !pinned.value
}

const matched = computed(() => matchProfile(effTabUrl.value))

// Mode resolution:
//   - profile-mode wins when a profile matches AND its flag is enabled
//   - otherwise detector-mode renders if its flag is enabled
//   - both off → blocked notice
const mode = computed(() => {
  if (matched.value && profileEnabled.value) return 'profile'
  if (detectorEnabled.value)                 return 'page'
  return 'blocked'
})

const headerTitle = computed(() => {
  if (mode.value === 'profile') return t('Quick Info')
  if (mode.value === 'page')    return t('Quick Page Info')
  return t('Quick Info')
})

const contentTitle = computed(() =>
  mode.value === 'profile' ? matched.value?.name : t('Quick Page Info')
)
const contentSubtitle = computed(() =>
  mode.value === 'profile'
    ? (matched.value?.description ?? '')
    : t('No profile configured for this URL — showing page detection.')
)

const profileRef = ref(null)
const pageRef    = ref(null)

onMounted(() => fetchProfiles())

async function onRefresh() {
  try {
    await fetchProfiles({ force: true })
    if (mode.value === 'profile') await profileRef.value?.runExtraction?.()
    else if (mode.value === 'page') await pageRef.value?.refresh?.()
  } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack :title="headerTitle" />

    <div class="flex-1 px-3 py-3 space-y-3">
      <!-- shared content header: title left, pin + refresh actions right -->
      <div v-if="mode !== 'blocked'" class="px-1 flex items-start gap-1.5">
        <div class="flex-1 min-w-0">
          <div class="text-xs font-semibold truncate">{{ contentTitle }}</div>
          <div v-if="contentSubtitle" class="text-[10px] text-muted/70 mt-0.5 truncate">{{ contentSubtitle }}</div>
          <div v-if="pinned" class="flex items-center gap-1 mt-1 text-[10px] text-primary min-w-0">
            <Icon name="mdiPin" :size="10" class="shrink-0" />
            <code class="truncate font-mono">{{ pinnedHost }}</code>
          </div>
        </div>
        <BaseButton
          variant="icon"
          :icon="pinned ? 'mdiLock' : 'mdiLockOpenVariantOutline'"
          :icon-size="15"
          :class="pinned ? 'text-primary!' : ''"
          :tooltip="pinned
            ? t('Pinned — tab switches are ignored. Click to follow the active tab again.')
            : t('Following the active tab. Click to pin the current page.')"
          @click="togglePin"
        />
        <BaseButton
          variant="icon"
          icon="mdiRefresh"
          :icon-size="15"
          :tooltip="t('Refresh')"
          @click="onRefresh"
        />
      </div>

      <div v-if="profilesState.loading && !profilesState.profiles.length && profileEnabled" class="text-xs text-muted px-2 py-3">
        {{ t('Loading profiles…') }}
      </div>

      <ProfileInfoView
        v-else-if="mode === 'profile'"
        ref="profileRef"
        :profile="matched"
        :tab-id="effTabId"
        :tab-url="effTabUrl"
      />

      <PageInfoView
        v-else-if="mode === 'page'"
        ref="pageRef"
        :tab-id="effTabId"
        :tab-url="effTabUrl"
      />

      <div v-else class="text-xs text-muted/70 px-2 py-6 text-center">
        <Icon name="mdiToggleSwitchOffOutline" :size="24" class="mx-auto mb-2 opacity-50" />
        <p>{{ t('Both Quick Info modes are disabled.') }}</p>
        <p class="mt-1 text-[10px] opacity-60">{{ t('Enable at least one mode in admin → Feature flags.') }}</p>
      </div>

      <div v-if="profilesState.error && profileEnabled" class="text-[10px] text-muted/60 italic px-2">
        {{ t('Profile lookup failed:') }} {{ profilesState.error }}
      </div>
    </div>
  </div>
</template>
