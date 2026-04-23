<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route  = useRoute()
const router = useRouter()

const crumbs = computed(() => {
  const list = [{ label: 'Dashboard', to: '/' }]
  const { serviceName, serviceId, moduleName } = route.meta

  if (serviceName) {
    list.push({
      label: serviceName,
      to: serviceId ? `/service/${serviceId}` : null,
    })
  }

  if (moduleName) {
    list.push({ label: moduleName, to: null })
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