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
  <Teleport to="body">
    <Transition name="rd-fade">
      <div
        v-if="dialog.open"
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        @click.self="closeDialog"
      >
        <div class="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
          <header class="px-5 py-4 border-b border-border flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="mdiBugOutline" :size="18" class="text-primary" />
              <h2 class="font-semibold">{{ t('Submit report') }}</h2>
            </div>
            <BaseButton variant="surface-icon" icon="mdiClose" :icon-size="15" @click="closeDialog" />
          </header>

          <div class="px-5 py-4 space-y-4">
            <!-- Context box: the system-bound info (module, origin, issue)
                 stays here regardless of what the user types into title +
                 description. The user can change wording, but the admin
                 always sees which module / element a report came from. -->
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

            <div>
              <label class="text-[10px] uppercase tracking-wide text-muted/60 block mb-1">{{ t('Category') }}</label>
              <select v-model="draft.category" class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary/60">
                <option value="bug">{{ t('Bug — something is broken') }}</option>
                <option value="false_positive">{{ t('False positive — the module flagged something that is fine') }}</option>
                <option value="feature_request">{{ t('Feature request') }}</option>
                <option value="other">{{ t('Other') }}</option>
              </select>
            </div>

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

            <div>
              <label class="text-[10px] uppercase tracking-wide text-muted/60 block mb-1">{{ t('Title') }}</label>
              <input
                v-model="draft.title"
                maxlength="200"
                :placeholder="t('Short one-line summary')"
                class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary/60"
              />
            </div>

            <div>
              <label class="text-[10px] uppercase tracking-wide text-muted/60 block mb-1">{{ t('Description') }}</label>
              <textarea
                v-model="draft.description"
                rows="5"
                maxlength="5000"
                :placeholder="t('What did you expect? What happened instead? Steps to reproduce help a lot.')"
                class="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:border-primary/60"
              />
            </div>
          </div>

          <footer class="px-5 py-4 border-t border-border flex justify-end gap-2">
            <BaseButton variant="pill" @click="closeDialog">{{ t('Cancel') }}</BaseButton>
            <BaseButton variant="pill" class="bg-primary! border-primary! text-black/80!" :loading="submitting" @click="onSubmit">
              {{ t('Submit') }}
            </BaseButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.rd-fade-enter-active,
.rd-fade-leave-active { transition: opacity .18s ease; }
.rd-fade-enter-from,
.rd-fade-leave-to     { opacity: 0; }
</style>
