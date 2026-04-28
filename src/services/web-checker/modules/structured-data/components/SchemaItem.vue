<script setup>
import { computed, reactive } from 'vue'

const props = defineProps({ item: Object })

function schemaEntries(schema) {
  if (!schema) return []
  return Object.entries(schema)
    .filter(([k]) => k !== '@context' && k !== 'image')
    .map(([k, v]) => ({
      key: k,
      value: typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''),
    }))
}

function entityLabel(schema) {
  return schema?.name
      ?? schema?.author?.name
      ?? schema?.headline
      ?? schema?.title
      ?? schema?.description
      ?? ''
}

const entities = computed(() => props.item._meta?.entities ?? [])

const firstImage = computed(() => {
  const ent = entities.value.find(e => e.image?.url && e.image?.reachable)
  return ent?.image?.url ?? null
})

const normalized = computed(() => ({
  ...props.item,
  title: props.item.name,
  image: firstImage.value,
}))

const openMap = reactive({})
function toggle(idx) { openMap[idx] = !openMap[idx] }
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40">

        <div
          v-for="(entity, idx) in entities"
          :key="idx"
          class="border-b border-border/40 last:border-b-0"
        >
          <button
            @click="toggle(idx)"
            class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-soft-hover transition-colors"
            :class="openMap[idx] ? 'bg-surface' : 'bg-surface-soft'"
          >
            <Icon
              name="mdiChevronDown"
              :size="13"
              class="transition-transform duration-200 text-muted/60 shrink-0"
              :class="openMap[idx] ? 'rotate-180' : ''"
            />
            <span class="text-xs font-mono text-muted/60 shrink-0">#{{ idx + 1 }}</span>
            <span class="text-xs text-light truncate flex-1">{{ entityLabel(entity.schema) || item.name }}</span>
          </button>

          <div v-if="openMap[idx]" class="bg-surface/30">

            <div v-if="entity.image?.url" class="flex gap-3 px-3 py-2.5 border-b border-border/40">
              <span class="text-xs text-muted/60 shrink-0 w-28 font-mono">image</span>
              <div class="flex gap-3 min-w-0 flex-1">
                <div
                  v-if="entity.image.reachable"
                  style="width:64px; height:64px; flex-shrink:0;"
                  class="rounded-lg overflow-hidden bg-surface flex items-center justify-center border border-border/40"
                >
                  <img
                    :src="entity.image.url"
                    :style="`width:64px; height:64px; object-fit:${entity.image.url.endsWith('.svg') ? 'contain' : 'cover'}; padding:${entity.image.url.endsWith('.svg') ? '6px' : '0'}`"
                    loading="lazy"
                  />
                </div>
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span
                    class="text-xs font-medium"
                    :class="entity.image.reachable ? 'text-success' : 'text-error'"
                  >{{ entity.image.reachable ? 'Erreichbar' : 'Nicht erreichbar' }}</span>
                  <span
                    v-if="entity.image.reachable && entity.image.width"
                    class="text-xs text-muted"
                  >{{ entity.image.width }}×{{ entity.image.height }}px</span>
                  <span class="text-muted/60 break-all font-mono" style="font-size:10px">{{ entity.image.url }}</span>
                </div>
              </div>
            </div>

            <div
              v-for="entry in schemaEntries(entity.schema)"
              :key="entry.key"
              class="flex gap-3 px-3 py-2 border-b border-border/40 last:border-b-0"
            >
              <span class="text-xs text-muted/60 shrink-0 w-28 truncate font-mono">{{ entry.key }}</span>
              <span class="text-xs text-light break-all">{{ entry.value }}</span>
            </div>

          </div>
        </div>

        <div
          v-if="!entities.length"
          class="px-3 py-2.5 text-xs text-muted/60"
        >
          Keine Detaildaten verfügbar.
        </div>

      </div>
    </template>
  </ModuleItem>
</template>
