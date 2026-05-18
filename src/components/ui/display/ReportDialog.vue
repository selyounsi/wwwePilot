<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n }    from '@/composables/i18n/useI18n.js'
import { useToast }   from '@/composables/useToast.js'
import { useReports } from '@/composables/useReports.js'

const { t } = useI18n()
const toast = useToast()
const { dialog, closeDialog, submit } = useReports()

const draft = ref({
  scope:       'app',
  title:       '',
  description: '',
  category:    'bug',
  severity:    'medium',
})
const submitting = ref(false)

const prefill = computed(() => dialog.prefill ?? {})

const scopeHeading = computed(() => {
  switch (prefill.value.scope) {
    case 'module_item': return t('Module finding')
    case 'module':      return t('Module-wide issue')
    default:            return t('General report')
  }
})

const scopeColor = computed(() => {
  switch (prefill.value.scope) {
    case 'module_item': return 'bg-error/10  border-error/30  text-error'
    case 'module':      return 'bg-alert/10  border-alert/30  text-alert'
    default:            return 'bg-primary/10 border-primary/30 text-primary'
  }
})

const categoryOptions = [
  { value: 'bug',             label: 'Bug — something is broken' },
  { value: 'false_positive',  label: 'False positive — the module flagged something that is fine' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other',           label: 'Other' },
]

watch(() => dialog.open, (open) => {
  if (!open) return
  const p = dialog.prefill ?? {}
  draft.value = {
    scope:       p.scope     ?? 'app',
    title:       p.title     ?? '',
    description: '',
    category:    'bug',
    severity:    'medium',
  }
})

async function onSubmit() {
  if (!draft.value.title.trim() || !draft.value.description.trim()) {
    toast.error(t('Please fill in both title and description.'))
    return
  }
  submitting.value = true
  try {
    await submit({
      ...dialog.prefill,
      ...draft.value,
    })
    toast.success(t('Report submitted — admins will review it.'))
    closeDialog()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal :open="dialog.open" size="lg" @update:open="!$event && closeDialog()">
    <template #header>
      <div class="flex items-center gap-2">
        <Icon name="mdiBugOutline" :size="18" class="text-primary" />
        <h2 class="font-semibold">{{ t('Submit report') }}</h2>
      </div>
    </template>

    <div class="space-y-4">
      <div :class="['rounded-lg border p-3 space-y-1.5', scopeColor]">
        <div class="flex items-center gap-1.5">
          <Icon
            :name="prefill.scope === 'module_item' ? 'mdiAlertCircleOutline'
                 : prefill.scope === 'module'      ? 'mdiPuzzleOutline'
                                                   : 'mdiInformationOutline'"
            :size="14"
          />
          <span class="text-[11px] font-semibold uppercase tracking-wide">{{ scopeHeading }}</span>
        </div>
        <div v-if="prefill.moduleId" class="text-[11px]">
          <span class="opacity-70">{{ t('Module') }}:</span>
          <code class="ml-1 font-mono">{{ prefill.moduleId }}</code>
        </div>
        <div v-if="prefill.scope === 'module_item' && prefill.issueMessage" class="text-[11px]">
          <span class="opacity-70">{{ t('Finding') }}:</span>
          <span class="ml-1 font-medium">{{ prefill.issueMessage }}</span>
        </div>
        <div v-if="prefill.elementHint" class="text-[10px] opacity-80 truncate" :title="prefill.elementHint">
          <span class="opacity-70">{{ t('Element') }}:</span>
          <span class="ml-1 font-mono">{{ prefill.elementHint }}</span>
        </div>
        <div v-if="prefill.origin" class="text-[10px] opacity-80 truncate" :title="prefill.origin">
          <span class="opacity-70">{{ t('Page') }}:</span>
          <span class="ml-1 font-mono">{{ prefill.origin }}{{ prefill.scopePath || '' }}</span>
        </div>
      </div>

      <SelectField v-model="draft.category" :label="t('Category')" :options="categoryOptions" full-width />

      <div>
        <label class="text-[10px] uppercase tracking-wide text-muted/60 block mb-1">{{ t('Severity') }}</label>
        <div class="inline-flex gap-1">
          <button
            v-for="s in ['low', 'medium', 'high']" :key="s"
            @click="draft.severity = s"
            class="text-[11px] px-3 py-1 rounded-full border transition-colors"
            :class="draft.severity === s
              ? 'bg-primary text-black/80 border-primary'
              : 'bg-surface border-border text-muted hover:bg-surface-soft-hover'"
          >{{ t(s) }}</button>
        </div>
      </div>

      <FormField
        v-model="draft.title"
        :label="t('Title')"
        :placeholder="t('Short one-line summary')"
        maxlength="200"
      />

      <TextareaField
        v-model="draft.description"
        :label="t('Description')"
        :placeholder="t('What did you expect? What happened instead? Steps to reproduce help a lot.')"
        :rows="5"
        maxlength="5000"
      />
    </div>

    <template #footer>
      <div class="ml-auto flex gap-2">
        <BaseButton variant="pill" @click="closeDialog">{{ t('Cancel') }}</BaseButton>
        <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" :loading="submitting" @click="onSubmit">
          {{ t('Submit') }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
