<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth }  from '@/composables/auth/useAuth.js'
import { useI18n }  from '@/composables/i18n/useI18n.js'
import { useToast } from '@/composables/useToast.js'
import { APP_NAME } from '@/config/app.js'

const router = useRouter()
const route  = useRoute()
const { t }  = useI18n()
const { login } = useAuth()
const toast = useToast()

const error = ref(null)
const busy  = ref(false)

function categorize(err) {
  const msg = (err?.message || '').toLowerCase()
  if (msg.includes('could not be loaded') || msg.includes('authorization page')) return 'network'
  if (msg === 'login cancelled' || msg.includes('did not finish'))               return 'cancelled'
  if (msg.includes('did not approve') || msg.includes('not granted') || msg.includes('access denied')) return 'denied'
  if (msg.includes('missing tokens') || msg.includes('oidc'))                    return 'token-error'
  return 'unknown'
}

const errorIcon = computed(() => {
  switch (error.value?.kind) {
    case 'network':     return 'mdiCloudAlertOutline'
    case 'cancelled':   return 'mdiCloseCircleOutline'
    case 'denied':      return 'mdiAccountCancelOutline'
    case 'token-error': return 'mdiKeyAlertOutline'
    default:            return 'mdiAlertCircleOutline'
  }
})

const errorTitle = computed(() => {
  switch (error.value?.kind) {
    case 'network':     return t('Backend not reachable')
    case 'cancelled':   return t('Sign-in cancelled')
    case 'denied':      return t('Permission denied')
    case 'token-error': return t('Backend error')
    default:            return t('Login failed')
  }
})

const errorBody = computed(() => {
  switch (error.value?.kind) {
    case 'network':     return t('The sign-in page could not be loaded.')
    case 'cancelled':   return t('You closed the sign-in window.')
    case 'denied':      return t('The provider rejected the sign-in.')
    case 'token-error': return t('Tokens could not be issued. Please contact IT.')
    default:            return error.value?.message || ''
  }
})

const errorHints = computed(() => {
  if (error.value?.kind !== 'network') return []
  return [
    t('VPN not connected — start the wwwe VPN and retry'),
    t('Backend offline — try again in a moment'),
    t('Firewall is blocking the request — check with IT'),
  ]
})

async function onLogin() {
  busy.value  = true
  error.value = null
  try {
    const user = await login()
    const first = user?.firstName
    toast.success(first ? t('Hi, {name}!', { name: first }) : t('Signed in'))
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    error.value = { kind: categorize(e), message: e.message || '' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <div class="bg-primary px-4 py-5">
      <h1 class="text-lg font-bold leading-tight">{{ APP_NAME }}</h1>
      <p class="text-xs text-black/50 mt-0.5">{{ t('Sign in to continue') }}</p>
    </div>

    <div class="flex-1 px-4 py-8 flex flex-col gap-6 justify-center">
      <div class="flex flex-col items-center gap-3 text-center">
        <Icon name="mdiAccountCircleOutline" :size="48" class="text-muted/50" />
        <p class="text-sm text-light max-w-xs">
          {{ t('You will be redirected to the wwwe sign-in page in a new window.') }}
        </p>
      </div>

      <BaseButton :loading="busy" @click="onLogin">
        <template #loading>{{ t('Opening sign-in…') }}</template>
        {{ t('Sign in with wwwe account') }}
      </BaseButton>

      <div
        v-if="error"
        class="border rounded-xl p-3 flex flex-col gap-2"
        :class="error.kind === 'cancelled'
          ? 'bg-surface-soft border-border'
          : 'bg-error/10 border-error/40'"
      >
        <div class="flex items-start gap-2">
          <Icon
            :name="errorIcon"
            :size="18"
            :class="error.kind === 'cancelled' ? 'text-muted shrink-0 mt-0.5' : 'text-error shrink-0 mt-0.5'"
          />
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-xs font-semibold text-light">{{ errorTitle }}</span>
            <span class="text-[11px] text-muted leading-snug">{{ errorBody }}</span>
          </div>
        </div>

        <ul v-if="errorHints.length" class="text-[11px] text-muted leading-snug pl-6 list-disc marker:text-error/60 flex flex-col gap-0.5">
          <li v-for="h in errorHints" :key="h">{{ h }}</li>
        </ul>

        <BaseButton
          variant="ghost"
          icon="mdiRefresh"
          :icon-size="13"
          class="text-xs! py-2!"
          @click="onLogin"
        >
          {{ t('Try again') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
