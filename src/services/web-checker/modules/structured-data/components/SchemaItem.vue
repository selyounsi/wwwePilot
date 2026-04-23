<script setup>
import { computed } from 'vue'

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

const normalized = computed(() => ({
  ...props.item,
  title: props.item.name,
  image: (props.item._meta?.image?.url && props.item._meta?.image?.reachable)
          ? props.item._meta.image.url
          : null,
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40">

        <!-- Image details -->
        <div v-if="item._meta?.image?.url" class="flex gap-3 px-3 py-2.5 border-b border-border/40">
          <span class="text-xs text-muted/60 shrink-0 w-28 font-mono">image</span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span
              class="text-xs font-medium"
              :class="item._meta.image.reachable ? 'text-success' : 'text-error'"
            >{{ item._meta.image.reachable ? 'Erreichbar' : 'Nicht erreichbar' }}</span>
            <span
              v-if="item._meta.image.reachable && item._meta.image.width"
              class="text-xs text-muted"
            >{{ item._meta.image.width }}×{{ item._meta.image.height }}px</span>
            <span class="text-muted/60 break-all font-mono" style="font-size:10px">{{ item._meta.image.url }}</span>
          </div>
        </div>

        <!-- Schema key-value entries -->
        <div
          v-for="entry in schemaEntries(item._meta?.schema)"
          :key="entry.key"
          class="flex gap-3 px-3 py-2 border-b border-border/40 last:border-b-0"
        >
          <span class="text-xs text-muted/60 shrink-0 w-28 truncate font-mono">{{ entry.key }}</span>
          <span class="text-xs text-light break-all">{{ entry.value }}</span>
        </div>

        <!-- Fallback wenn keine Daten -->
        <div
          v-if="!item._meta?.image?.url && !schemaEntries(item._meta?.schema).length"
          class="px-3 py-2.5 text-xs text-muted/60"
        >
          Keine Detaildaten verfügbar.
        </div>

      </div>
    </template>
  </ModuleItem>
</template>
