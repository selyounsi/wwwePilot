<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'

/**
 * Shared modal scaffold: backdrop + centered card + fade/pop transitions +
 * Esc-to-close + click-outside-to-close. Replaces 9 hand-rolled
 * `<Teleport> + <Transition>` stacks across ConfirmDialog, ReportDialog,
 * ApiTokenCreateModal, ApiTokenRevealModal, AdminQuickSwitcher, QuickNav,
 * ClaudeResult, ReportItemButton, etc.
 *
 *  <BaseModal v-model:open="show" title="…" size="md">
 *    <template #actions> <BaseButton ... /> </template>
 *    <p>body</p>
 *    <template #footer>
 *      <BaseButton variant="ghost" @click="show = false">Cancel</BaseButton>
 *      <BaseButton @click="submit">Save</BaseButton>
 *    </template>
 *  </BaseModal>
 *
 * If you need a non-standard layout (top-anchored search palette,
 * full-bleed image), set `align="top"` and `size="custom"` then style the
 * `#default`-slot's card directly via the `body-class` prop.
 */

const props = defineProps({
  open:            { type: Boolean, required: true },
  title:           { type: String, default: '' },
  size:            { type: String, default: 'md' }, // sm | md | lg | xl | custom
  align:           { type: String, default: 'center' }, // center | top
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEsc:      { type: Boolean, default: true },
  bodyClass:       { type: String, default: '' },
  noPadding:       { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'close'])

function close() {
  emit('close')
  emit('update:open', false)
}

function onKey(e) {
  if (props.closeOnEsc && e.key === 'Escape' && props.open) close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':     return 'max-w-sm'
    case 'lg':     return 'max-w-2xl'
    case 'xl':     return 'max-w-4xl'
    case 'custom': return ''
    default:       return 'max-w-md'
  }
})

const wrapperClass = computed(() =>
  props.align === 'top'
    ? 'items-start justify-center pt-24'
    : 'items-center justify-center',
)

// Prevent body scroll while open so the page doesn't jump when a modal
// opens over a long admin view. Mirrored on close.
let prevBodyOverflow = null
watch(() => props.open, (v) => {
  if (v) {
    prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else if (prevBodyOverflow !== null) {
    document.body.style.overflow = prevBodyOverflow
    prevBodyOverflow = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="bm-fade">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/60 z-50"
        @click="closeOnBackdrop && close()"
      />
    </Transition>
    <Transition name="bm-pop">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex p-4 pointer-events-none"
        :class="wrapperClass"
      >
        <div
          class="bg-background border border-border rounded-2xl w-full shadow-2xl pointer-events-auto flex flex-col max-h-[90vh]"
          :class="[sizeClass, bodyClass]"
          @click.stop
        >
          <header
            v-if="title || $slots.header || $slots.actions"
            class="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0"
          >
            <slot name="header">
              <h3 v-if="title" class="text-sm font-semibold flex-1 truncate">{{ title }}</h3>
            </slot>
            <div class="flex items-center gap-1 ml-auto shrink-0">
              <slot name="actions" />
              <BaseButton
                variant="icon"
                icon="mdiClose"
                :icon-size="14"
                @click="close"
              />
            </div>
          </header>

          <div class="overflow-y-auto flex-1" :class="!noPadding && 'p-4'">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="flex items-center gap-2 px-4 py-3 border-t border-border/60 shrink-0">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bm-fade-enter-active, .bm-fade-leave-active { transition: opacity .18s ease; }
.bm-fade-enter-from, .bm-fade-leave-to       { opacity: 0; }
.bm-pop-enter-active, .bm-pop-leave-active   { transition: transform .2s cubic-bezier(.32,.72,0,1), opacity .18s ease; }
.bm-pop-enter-from, .bm-pop-leave-to         { transform: scale(.96); opacity: 0; }
</style>
