<script setup>
defineProps({
  modelValue: { type: String, required: true },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex items-center gap-1 bg-black/10 rounded-xl p-0.5">
    <button
      @click="$emit('update:modelValue', 'wwwe')"
      class="px-3 py-1 rounded-lg text-xs font-medium transition-all"
      :class="modelValue === 'wwwe'
        ? 'bg-white/20 text-black/80 shadow-sm'
        : 'text-black/40 hover:text-black/60'"
    >wwwe</button>
    <button
      @click="$emit('update:modelValue', 'claude')"
      class="px-3 py-1 rounded-lg text-xs font-medium transition-all"
      :class="modelValue === 'claude'
        ? 'bg-white/20 text-black/80 shadow-sm'
        : 'text-black/40 hover:text-black/60'"
    >Claude</button>
  </div>
</template>
