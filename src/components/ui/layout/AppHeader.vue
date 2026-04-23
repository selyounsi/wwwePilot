<script setup>
import { useRouter, useRoute } from 'vue-router'
import { computed, ref, onMounted, onUnmounted } from 'vue'

const router = useRouter()
const route  = useRoute()

const props = defineProps({
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon:     { type: String, default: '' },
  showBack: { type: Boolean, default: false },
})

const resolvedIcon     = computed(() => props.icon     || route.meta.icon        || '')
const resolvedTitle    = computed(() => props.title    || route.meta.moduleName  || route.meta.serviceName || '')
const resolvedSubtitle = computed(() => props.subtitle || route.meta.description || '')

// Breadcrumb ausblenden sobald gescrollt wird
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

    <!-- Breadcrumb – Platz fährt ein/aus, kein Layout-Loop -->
    <div v-if="showBack"
      class="px-4 overflow-hidden transition-all duration-200 ease-in-out"
      :style="scrolled ? 'max-height:0; opacity:0; padding-top:0' : 'max-height:40px; opacity:1; padding-top:12px'">
      <BreadCrumb />
    </div>

    <!-- Hauptzeile -->
    <div class="px-4 pt-3 flex items-center gap-3" :class="$slots.below ? 'pb-2' : 'pb-4'">
      <button v-if="showBack" @click="router.back()"
        class="w-8 h-8 flex items-center justify-center rounded-lg bg-black/10 hover:bg-black/20 transition-colors text-lg shrink-0">
        ‹
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold leading-tight">{{ resolvedTitle }}</h1>
        <p v-if="resolvedSubtitle" class="text-xs text-black/50 mt-0.5">{{ resolvedSubtitle }}</p>
      </div>
      <slot />
    </div>

    <!-- Optionale Aktionsleiste unter dem Titel -->
    <div v-if="$slots.below" class="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
      <slot name="below" />
    </div>

  </div>
</template>