<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  text:  { type: String, default: '' },
  delay: { type: Number, default: 350 },
})

const HIDE_DELAY_MS = 80
const GAP_PX        = 6

const wrapper = ref(null)
let tipEl   = null
let showT   = null
let hideT   = null

function position(tip, target) {
  const r       = target.getBoundingClientRect()
  const tipRect = tip.getBoundingClientRect()
  const vw      = window.innerWidth

  let top  = r.top - tipRect.height - GAP_PX
  if (top < 4) top = r.bottom + GAP_PX

  let left = r.left + (r.width / 2) - (tipRect.width / 2)
  if (left < 4)                       left = 4
  if (left + tipRect.width > vw - 4)  left = vw - tipRect.width - 4

  tip.style.top  = `${top}px`
  tip.style.left = `${left}px`
}

function showTip() {
  if (!props.text) return
  clearTimeout(hideT)
  showT = setTimeout(() => {
    if (tipEl) tipEl.remove()
    const tip = document.createElement('div')
    tip.className = [
      'fixed z-[9999] pointer-events-none',
      'px-2 py-1 rounded-md text-[11px] leading-snug font-medium',
      'bg-surface border border-border text-light shadow-lg',
      'max-w-[260px] whitespace-pre-wrap break-words',
      'opacity-0 transition-opacity duration-150',
    ].join(' ')
    tip.textContent = props.text
    document.body.appendChild(tip)
    tipEl = tip
    requestAnimationFrame(() => {
      const target = wrapper.value?.firstElementChild ?? wrapper.value
      position(tip, target)
      tip.style.opacity = '1'
    })
  }, props.delay)
}

function hideTip() {
  clearTimeout(showT)
  hideT = setTimeout(() => {
    if (tipEl) {
      tipEl.remove()
      tipEl = null
    }
  }, HIDE_DELAY_MS)
}

onMounted(() => {
  const root = wrapper.value
  if (!root) return
  root.addEventListener('mouseenter', showTip)
  root.addEventListener('mouseleave', hideTip)
  root.addEventListener('focusin',    showTip)
  root.addEventListener('focusout',   hideTip)
  root.addEventListener('click',      hideTip)
})

onUnmounted(() => {
  clearTimeout(showT)
  clearTimeout(hideT)
  if (tipEl) tipEl.remove()
})

watch(() => props.text, (v) => {
  if (tipEl) tipEl.textContent = v
})
</script>

<template>
  <span ref="wrapper" class="contents">
    <slot />
  </span>
</template>
