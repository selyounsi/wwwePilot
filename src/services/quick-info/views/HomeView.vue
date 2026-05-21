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

const matched = computed(() => matchProfile(tabUrl.value))

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
    <AppHeader showBack :title="headerTitle">
      <BaseButton
        v-if="mode !== 'blocked'"
        variant="icon"
        icon="mdiRefresh"
        :icon-size="16"
        :tooltip="t('Refresh')"
        @click="onRefresh"
      />
    </AppHeader>

    <div class="flex-1 px-3 py-3 space-y-3">
      <div v-if="profilesState.loading && !profilesState.profiles.length && profileEnabled" class="text-xs text-muted px-2 py-3">
        {{ t('Loading profiles…') }}
      </div>

      <ProfileInfoView
        v-else-if="mode === 'profile'"
        ref="profileRef"
        :profile="matched"
        :tab-id="tabId"
        :tab-url="tabUrl"
      />

      <PageInfoView
        v-else-if="mode === 'page'"
        ref="pageRef"
        :tab-id="tabId"
        :tab-url="tabUrl"
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
