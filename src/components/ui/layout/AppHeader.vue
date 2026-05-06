<script setup>
import { useRouter, useRoute } from 'vue-router'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'

const router = useRouter()
const route  = useRoute()
const { t }  = useI18n()

const props = defineProps({
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon:     { type: String, default: '' },
  showBack: { type: Boolean, default: false },
})

const resolvedIcon     = computed(() => props.icon || route.meta.icon || '')
const resolvedTitle    = computed(() => {
  if (props.title) return props.title
  const raw = route.meta.moduleName || route.meta.serviceName || ''
  return raw ? t(raw) : ''
})
const resolvedSubtitle = computed(() => {
  if (props.subtitle) return props.subtitle
  const raw = route.meta.description || ''
  return raw ? t(raw) : ''
})

// hide breadcrumb once scrolled past 30px
const scrolled = ref(false)

function onScroll() {
  if (!scrolled.value && window.scrollY > 30) scrolled.value = true
  if (scrolled.value && window.scrollY === 0)  scrolled.value = false
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="bg-primary sticky top-0 z-50">

    <div v-if="showBack"
      class="px-4 overflow-hidden transition-all duration-200 ease-in-out"
      :style="scrolled ? 'max-height:0; opacity:0; padding-top:0' : 'max-height:40px; opacity:1; padding-top:12px'">
      <BreadCrumb />
    </div>

    <div class="px-4 pt-3 flex items-center gap-3" :class="$slots.below ? 'pb-2' : 'pb-4'">
      <BaseButton
        v-if="showBack"
        variant="header-icon"
        :tooltip="t('Back')"
        class="w-8 h-8 bg-black/10 hover:bg-black/20 text-lg shrink-0"
        @click="router.back()"
      >
        ‹
      </BaseButton>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold leading-tight">{{ resolvedTitle }}</h1>
        <p v-if="resolvedSubtitle" class="text-xs text-black/50 mt-0.5">{{ resolvedSubtitle }}</p>
      </div>
      <slot />
      <QuickNav />
    </div>

    <div v-if="$slots.below" class="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
      <slot name="below" />
    </div>

  </div>
</template>