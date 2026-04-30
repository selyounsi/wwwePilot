<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n/useI18n.js'

const route  = useRoute()
const router = useRouter()
const { t }  = useI18n()

const crumbs = computed(() => {
  const home = { label: t('Dashboard'), to: '/' }

  if (route.meta.settingsRoot) {
    return [home, { label: t('Settings'), to: null }]
  }

  if (route.meta.isServiceSettings) {
    return [
      home,
      { label: t('Settings'),                   to: '/settings' },
      { label: t(route.meta.serviceName ?? ''), to: null },
    ]
  }

  if (route.meta.isModuleSettings) {
    const { serviceId, serviceName, moduleName } = route.meta
    return [
      home,
      { label: t('Settings'),       to: '/settings' },
      { label: t(serviceName ?? ''), to: serviceId ? `/service/${serviceId}/settings` : null },
      { label: t(moduleName ?? ''), to: null },
    ]
  }

  const list = [home]
  const { serviceName, serviceId, moduleName } = route.meta

  if (serviceName) {
    list.push({
      label: t(serviceName),
      to: serviceId ? `/service/${serviceId}` : null,
    })
  }

  if (moduleName) {
    list.push({ label: t(moduleName), to: null })
  }

  return list
})
</script>

<template>
  <nav class="flex items-center gap-1 text-xs">
    <template v-for="(crumb, i) in crumbs" :key="i">
      <span v-if="i > 0" class="text-black/30">›</span>
      <button v-if="crumb.to" @click="router.push(crumb.to)"
        class="text-black/50 hover:text-black/80 transition-colors">
        {{ crumb.label }}
      </button>
      <span v-else class="font-semibold text-black/80">{{ crumb.label }}</span>
    </template>
  </nav>
</template>
