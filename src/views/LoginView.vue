<script setup>
import { ref } from 'vue'
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

const error = ref('')
const busy  = ref(false)

async function onLogin() {
  busy.value  = true
  error.value = ''
  try {
    const user = await login()
    const greeting = user?.firstName || user?.username || user?.email || ''
    toast.success(greeting ? t('Hi, {name}!', { name: greeting }) : t('Signed in'))
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    error.value = e.message || t('Login failed')
    toast.error(error.value, { title: t('Login failed') })
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

      <p v-if="error" class="text-xs text-error text-center">{{ error }}</p>
    </div>
  </div>
</template>
