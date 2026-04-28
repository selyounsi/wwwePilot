<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title: props.item.name || (props.item.isBackground ? 'Hintergrundbild' : props.item.isLightbox ? 'Lightbox-Link' : 'Bild'),
  details: props.item.isBackground
    ? 'CSS background-image'
    : props.item.isLightbox
    ? (props.item.alt ? `aria-label: "${props.item.alt}"` : '')
    : (props.item.width ? `${props.item.width} × ${props.item.height}px` : ''),
  image: props.item.src || null,
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

        <div v-if="item.name" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Dateiname</span>
          <span class="text-xs text-light break-all">{{ item.name }}</span>
        </div>

        <div v-if="item.width" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Original</span>
          <span class="text-xs text-light">{{ item.width }} × {{ item.height }}px</span>
        </div>

        <div v-if="item.renderedWidth" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Gerendert</span>
          <span class="text-xs" :class="!item.isVector && (item.renderedWidth - item.width > 2 || item.renderedHeight - item.height > 2) ? 'text-alert' : 'text-light'">
            {{ item.renderedWidth }} × {{ item.renderedHeight }}px<span v-if="item.isVector" class="text-muted/60 ml-1">(Vektor)</span>
          </span>
        </div>

        <div v-if="item.src" class="flex gap-3 items-start">
          <span class="text-xs text-muted/60 shrink-0 w-20">Pfad</span>
          <span class="text-muted/70 break-all font-mono" style="font-size: 10px">{{ item.src }}</span>
        </div>

        <div
          v-for="issue in item.issues"
          :key="issue.message"
          class="text-xs"
          :class="issue.type === 'error' ? 'text-error' : 'text-alert'"
        >{{ issue.message }}</div>

      </div>
    </template>
  </ModuleItem>
</template>
