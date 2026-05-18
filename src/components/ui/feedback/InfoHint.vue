<script setup>
/**
 * Tiny info-icon with a hover tooltip. Use anywhere a concept needs a
 * one-sentence explanation without bloating the surrounding label.
 *
 *  <label>
 *    Force <InfoHint :text="t('Skip the LanguageTool check — use for brand names…')" />
 *  </label>
 *
 * Use `size` to match the typography around it (10px label → 11–12 icon).
 */

defineProps({
  text:  { type: String, required: true },
  size:  { type: Number, default: 12 },
  icon:  { type: String, default: 'mdiInformationOutline' },
  tone:  { type: String, default: 'muted' },
})

const toneClasses = {
  muted:   'text-muted/70 hover:text-light',
  primary: 'text-primary/70 hover:text-primary',
  alert:   'text-alert/80 hover:text-alert',
  error:   'text-error/80 hover:text-error',
}
</script>

<template>
  <Tooltip :text="text">
    <Icon
      :name="icon"
      :size="size"
      class="inline-block align-text-bottom cursor-help transition-colors"
      :class="toneClasses[tone] || toneClasses.muted"
    />
  </Tooltip>
</template>
