<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: Number, default: 32 },
})

function pick(values) {
  return values.find(v => typeof v === 'string' && v.trim().length > 0) ?? ''
}

const initials = computed(() => {
  const u = props.user
  if (!u) return '?'

  const first = pick([u.firstName, u.username, u.name, u.email])
  const last  = pick([u.lastName])

  if (first && last) return (first[0] + last[0]).toUpperCase()

  const fallback = pick([u.name, u.username, u.email])
  if (!fallback) return '?'

  const parts = fallback.split(/[\s._@-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return fallback.slice(0, 2).toUpperCase()
})

const hue = computed(() => {
  const seed = props.user?.id ?? props.user?.email ?? ''
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h) % 360
})

const fontSize = computed(() => Math.round(props.size * 0.4))
</script>

<template>
  <Tooltip :text="user?.email || ''">
    <div
      class="rounded-full flex items-center justify-center font-semibold shrink-0 select-none"
      :style="{
        width:  size + 'px',
        height: size + 'px',
        background: `hsl(${hue} 65% 45%)`,
        color: 'white',
        fontSize: fontSize + 'px',
      }"
    >
      {{ initials }}
    </div>
  </Tooltip>
</template>
