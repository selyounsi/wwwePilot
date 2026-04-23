<script setup>
defineProps({ type: { type: String, default: 'error' } })

const styles = {
  error:   'bg-error-soft   border border-error/20',
  warning: 'bg-alert-soft  border border-alert/20',
  success: 'bg-success-soft border border-success/20',
}
</script>

<template>
  <div :class="['rounded-xl px-4 py-3 text-sm', styles[type]]">
    <slot />
  </div>
</template>