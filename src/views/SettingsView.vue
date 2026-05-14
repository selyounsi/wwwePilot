<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n }          from '@/composables/i18n/useI18n.js'
import { useServiceLoader } from '@/composables/loaders/useServiceLoader.js'
import { useUiSettings }    from '@/composables/settings/useUiSettings.js'
import { useAuth }          from '@/composables/auth/useAuth.js'
import { apiJson }          from '@/composables/auth/apiClient.js'
import { useToast }         from '@/composables/useToast.js'
import { API }              from '@/config/api.js'

const router = useRouter()
const { t, lang, setLang, supportedLangs } = useI18n()
const { services } = useServiceLoader()
const {
  state: uiSettings,
  min:   zoomMin,
  max:   zoomMax,
  default: zoomDefault,
  incrementZoom, decrementZoom, resetZoom,
} = useUiSettings()
const { state: authState, logout } = useAuth()
const toast = useToast()

async function onLogout() {
  await logout()
  toast.info(t('Signed out'))
  router.replace({ name: 'login' })
}

const detailsOpen    = ref(false)
const detailsLoading = ref(false)
const detailsError   = ref(null)
const detailsData    = ref(null)

async function toggleDetails() {
  if (detailsOpen.value) {
    detailsOpen.value = false
    return
  }
  detailsOpen.value = true
  if (detailsData.value || detailsLoading.value) return

  detailsLoading.value = true
  detailsError.value   = null
  try {
    const { user } = await apiJson(`${API.auth.url}/me-extended`)
    detailsData.value = user
  } catch (e) {
    detailsError.value = e.message || t('Could not load details')
  } finally {
    detailsLoading.value = false
  }
}

async function copyValue(value) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(String(value))
    toast.success(t('Copied to clipboard'))
  } catch {
    toast.error(t('Could not copy'))
  }
}

function formatAppPermissions(perms) {
  if (!Array.isArray(perms) || perms.length === 0) return null
  if (perms.includes('*')) return t('Superadmin (alle)')
  return perms.join(', ')
}

const detailRows = computed(() => {
  const u = detailsData.value
  if (!u) return []
  const rows = [
    { key: 'id',              label: t('User ID'),         value: u.id,            copyable: true },
    { key: 'username',        label: t('Username'),        value: u.username,      copyable: true },
    { key: 'email',           label: t('Email'),           value: u.email,         copyable: true },
    { key: 'emailVerified',   label: t('Email verified'),  value: u.emailVerified === true ? t('Yes') : t('No') },
    { key: 'firstName',       label: t('First name'),      value: u.firstName },
    { key: 'lastName',        label: t('Last name'),       value: u.lastName },
    { key: 'displayName',     label: t('Display name'),    value: u.displayName },
    { key: 'companyName',     label: t('Company'),         value: u.companyName },
    { key: 'isSuperAdmin',    label: t('Superadmin'),      value: u.isSuperAdmin === true ? t('Yes') : t('No') },
    { key: 'appPermissions',  label: t('App permissions'), value: formatAppPermissions(u.appPermissions) },
    { key: 'oidcPermissions', label: t('OIDC permissions'), value: u.permissions?.length ? u.permissions.join(', ') : null },
  ]
  return rows.filter(r => r.value !== null && r.value !== undefined && r.value !== '')
})

const fetchedRelative = computed(() => {
  const ts = detailsData.value?.fetchedAt
  if (!ts) return null
  return new Date(ts).toLocaleString()
})

const subViewModules = import.meta.glob('@/services/*/views/*View.vue', { eager: true })
const servicesWithSettings = computed(() => {
  const ids = new Set()
  for (const path in subViewModules) {
    const parts    = path.split('/')
    const fileName = parts[parts.length - 1]
    if (fileName === 'SettingsView.vue') ids.add(parts[parts.length - 3])
  }
  return services.filter(s => ids.has(s.id))
})
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader showBack :title="t('Settings')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

      <section class="flex flex-col gap-2">
        <SectionLabel>{{ t('General settings') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
          <div class="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
            <Icon name="mdiTranslate" :size="14" class="text-muted shrink-0" />
            <span class="text-xs font-medium text-light">{{ t('Language') }}</span>
          </div>
          <div class="px-3 py-3 flex gap-2">
            <button
              v-for="code in supportedLangs" :key="code"
              @click="setLang(code)"
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              :class="lang === code
                ? 'bg-primary text-black/80'
                : 'bg-surface border border-border text-muted hover:bg-surface-soft-hover'"
            >
              {{ code.toUpperCase() }}
            </button>
          </div>
        </div>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
          <div class="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
            <Icon name="mdiMagnifyPlusOutline" :size="14" class="text-muted shrink-0" />
            <span class="text-xs font-medium text-light">{{ t('Zoom level') }}</span>
          </div>
          <div class="px-3 py-3 flex flex-col gap-2">
            <p class="text-[11px] text-muted leading-snug">
              {{ t('Scales only the sidebar — independent of the browser zoom (Ctrl +/-).') }}
            </p>
            <div class="flex items-center gap-2">
              <BaseButton
                variant="square"
                icon="mdiMinus"
                :icon-size="14"
                :tooltip="t('Decrease zoom')"
                :disabled="uiSettings.zoom <= zoomMin"
                @click="decrementZoom"
              />
              <BaseButton
                variant="square"
                :tooltip="t('Reset zoom to {n}%', { n: zoomDefault })"
                class="flex-1 text-light text-xs font-semibold tabular-nums"
                @click="resetZoom"
              >
                {{ uiSettings.zoom }}%
              </BaseButton>
              <BaseButton
                variant="square"
                icon="mdiPlus"
                :icon-size="14"
                :tooltip="t('Increase zoom')"
                :disabled="uiSettings.zoom >= zoomMax"
                @click="incrementZoom"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="servicesWithSettings.length" class="flex flex-col gap-2">
        <SectionLabel>{{ t('Service settings') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden flex flex-col">
          <button
            v-for="s in servicesWithSettings" :key="s.id"
            @click="router.push(`/service/${s.id}/settings`)"
            class="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-soft-hover transition-colors border-b border-border/30 last:border-b-0 text-left"
          >
            <Icon v-if="s.icon" :name="s.icon" :size="15" class="text-muted shrink-0" />
            <span class="text-xs text-light flex-1 truncate">{{ t(s.name) }}</span>
            <Icon name="mdiChevronRight" :size="14" class="text-muted/40 shrink-0" />
          </button>
        </div>
      </section>

      <section v-if="authState.user" class="flex flex-col gap-2">
        <SectionLabel>{{ t('Account') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
          <div class="px-3 py-3 flex items-center gap-3 border-b border-border/60">
            <UserAvatar :user="authState.user" :size="40" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-light truncate">
                {{ authState.user.firstName && authState.user.lastName
                    ? `${authState.user.firstName} ${authState.user.lastName}`
                    : authState.user.name || authState.user.username || authState.user.email }}
              </div>
              <div v-if="authState.user.email" class="text-[11px] text-muted truncate">
                {{ authState.user.email }}
              </div>
            </div>
            <BaseButton
              variant="icon"
              :icon="detailsOpen ? 'mdiInformation' : 'mdiInformationOutline'"
              :icon-size="16"
              :tooltip="detailsOpen ? t('Hide account details') : t('Show account details')"
              :class="detailsOpen ? 'text-primary' : ''"
              @click="toggleDetails"
            />
          </div>

          <div
            v-if="authState.user.roles?.length || authState.user.groups?.length"
            class="px-3 py-2.5 border-b border-border/60 flex flex-col gap-1.5"
          >
            <div v-if="authState.user.roles?.length" class="flex items-start gap-2">
              <span class="text-[10px] uppercase tracking-wide text-muted/60 mt-0.5 w-12 shrink-0">{{ t('Roles') }}</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="r in authState.user.roles" :key="r"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
                >{{ r }}</span>
              </div>
            </div>
            <div v-if="authState.user.groups?.length" class="flex items-start gap-2">
              <span class="text-[10px] uppercase tracking-wide text-muted/60 mt-0.5 w-12 shrink-0">{{ t('Groups') }}</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="g in authState.user.groups" :key="g"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-light"
                >{{ g }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="detailsOpen"
            class="px-3 py-2.5 border-b border-border/60 flex flex-col gap-1.5"
          >
            <div v-if="detailsLoading" class="flex items-center gap-2 text-[11px] text-muted py-1">
              <LoadingSpinner size="sm" />
              <span>{{ t('Loading account details…') }}</span>
            </div>
            <div v-else-if="detailsError" class="text-[11px] text-error">
              {{ detailsError }}
            </div>
            <template v-else-if="detailsData">
              <div
                v-for="row in detailRows" :key="row.key"
                class="flex items-start gap-2"
              >
                <span class="text-[10px] uppercase tracking-wide text-muted/60 mt-0.5 w-20 shrink-0">{{ row.label }}</span>
                <div class="flex-1 min-w-0 flex items-start gap-1">
                  <span class="text-[11px] text-light break-all">{{ row.value }}</span>
                  <BaseButton
                    v-if="row.copyable"
                    variant="icon"
                    icon="mdiContentCopy"
                    :icon-size="11"
                    :tooltip="t('Copy')"
                    class="shrink-0"
                    @click="copyValue(row.value)"
                  />
                </div>
              </div>
              <div v-if="fetchedRelative" class="text-[10px] text-muted/60 pt-1">
                {{ t('Fetched at {time}', { time: fetchedRelative }) }}
              </div>
            </template>
          </div>

          <div class="px-3 py-3">
            <BaseButton variant="ghost" @click="onLogout">
              {{ t('Sign out') }}
            </BaseButton>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
