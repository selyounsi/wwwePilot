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

const isUpscaled = computed(() =>
  !props.item.isVector
  && (props.item.renderedWidth - props.item.width > 2
   || props.item.renderedHeight - props.item.height > 2)
)
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">

        <DetailRow v-if="item.name" label="Dateiname">{{ item.name }}</DetailRow>

        <DetailRow v-if="item.width" label="Original">
          {{ item.width }} × {{ item.height }}px
        </DetailRow>

        <DetailRow v-if="item.renderedWidth" label="Gerendert">
          <span :class="isUpscaled ? 'text-alert' : ''">
            {{ item.renderedWidth }} × {{ item.renderedHeight }}px<span v-if="item.isVector" class="text-muted/60 ml-1">(Vektor)</span>
          </span>
        </DetailRow>

        <DetailRow v-if="item.src" label="Pfad">
          <span class="text-muted/70 font-mono" style="font-size: 10px">{{ item.src }}</span>
        </DetailRow>

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
