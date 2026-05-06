<script setup>
import { useClaude } from '../composables/useClaude.js'
import { useI18n }   from '@/composables/i18n/useI18n.js'

const props = defineProps({
  size:     { type: Number,  default: 13 },
  iconOnly: { type: Boolean, default: false },
  loading:  { type: Boolean, default: false },
  label:    { type: String,  default: '' },
  variant:  { type: String,  default: 'icon' },  // 'icon' | 'pill'
})

defineEmits(['click'])

const { isAvailable } = useClaude()
const { t }           = useI18n()
</script>

<template>
  <BaseButton
    v-if="isAvailable"
    :variant="variant"
    :loading="loading"
    :icon="loading ? '' : 'mdiAutoFix'"
    :icon-size="size"
    :tooltip="label || t('Ask Claude')"
    @click.stop="$emit('click', $event)"
  >
    <span v-if="!iconOnly && label && variant !== 'icon'" class="font-medium">{{ label }}</span>
  </BaseButton>
</template>
