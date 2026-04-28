<script setup>
import { computed, ref } from 'vue'
import { APP_NAME_LOWER } from '@/config/app.js'

const props = defineProps({ item: Object })

const fg = ref(props.item.fgHex)
const bg = ref(props.item.bgHex)

function luminance({ r, g, b }) {
  return [r, g, b].reduce((sum, c, i) => {
    const s = c / 255
    const l = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    return sum + l * [0.2126, 0.7152, 0.0722][i]
  }, 0)
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

const ratio = computed(() => {
  const l1 = luminance(hexToRgb(fg.value))
  const l2 = luminance(hexToRgb(bg.value))
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2)
})

const level = computed(() => {
  if (ratio.value >= 4.5) return { label: 'AA',       cls: 'text-success' }
  if (ratio.value >= 3)   return { label: 'AA Large', cls: 'text-alert'   }
  return                         { label: 'Fail',     cls: 'text-error'   }
})

const normalized = computed(() => ({
  ...props.item,
  title:   `${props.item.ratio}:1 – ${props.item.level}`,
  details: props.item.text,
}))

async function applyColors() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  const id = props.item.element
  const fgVal = fg.value
  const bgVal = bg.value
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (id, fgVal, bgVal, prefix) => {
      function findEl(id) {
        const el = document.querySelector(`[data-${prefix}-id="${id}"]`)
        if (el) return el
        for (const iframe of document.querySelectorAll('iframe')) {
          try {
            const found = iframe.contentDocument?.querySelector(`[data-${prefix}-id="${id}"]`)
            if (found) return found
          } catch {}
        }
        return null
      }
      const el = findEl(id)
      if (!el) return
      el.style.color           = fgVal
      el.style.backgroundColor = bgVal
    },
    args: [id, fgVal, bgVal, APP_NAME_LOWER],
  }).catch(() => {})
}
</script>

<template>
  <ModuleItem :item="normalized" variant="box">

    <!-- Farbpunkte als Preview im Hauptbereich -->
    <div class="flex items-center gap-1.5 mt-0.5">
      <span class="w-3 h-3 rounded-full border border-white/10 shrink-0" :style="`background:${item.fgHex}`" />
      <span class="w-3 h-3 rounded-full border border-white/10 shrink-0" :style="`background:${item.bgHex}`" />
    </div>

    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-3 flex flex-col gap-3">

        <!-- Vorschau -->
        <div
          class="rounded-lg px-3 py-2 text-sm font-medium text-center transition-colors"
          :style="`background:${bg}; color:${fg}`"
        >
          {{ item.text || 'Beispieltext' }}
        </div>

        <!-- Color Picker -->
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <p class="text-xs text-muted">Text</p>
            <div class="flex items-center gap-2 bg-background border border-border rounded-lg px-2 py-1.5">
              <input type="color" v-model="fg" @input="applyColors" class="w-5 h-5 cursor-pointer border-0 bg-transparent rounded" />
              <span class="text-xs font-mono">{{ fg }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <p class="text-xs text-muted">Hintergrund</p>
            <div class="flex items-center gap-2 bg-background border border-border rounded-lg px-2 py-1.5">
              <input type="color" v-model="bg" @input="applyColors" class="w-5 h-5 cursor-pointer border-0 bg-transparent rounded" />
              <span class="text-xs font-mono">{{ bg }}</span>
            </div>
          </div>
        </div>

        <!-- Kontrastverhältnis -->
        <div class="flex items-center justify-between px-1">
          <span class="text-xl font-bold">{{ ratio }}:1</span>
          <span class="text-lg font-bold" :class="level.cls">{{ level.label }}</span>
        </div>

      </div>
    </template>
  </ModuleItem>
</template>
