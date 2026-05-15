<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useCheckStore } from '@/services/web-checker/composables/useCheckStore.js'
import { useReports } from '@/composables/useReports.js'
import { computeIssueHash } from '@/composables/useIssueHash.js'

const props = defineProps({
  moduleId: { type: String, required: true },
  item:     { type: Object, required: true },
})

const { t } = useI18n()
const checkStore = useCheckStore()
const { openDialog: openReportDialog } = useReports()

const open = ref(false)

// Existing errors / warnings the user might want to flag as false positives.
// Empty for "success" items, which is the false-negative reporting case
// ("this looks fine to the module but is actually a problem").
const reportable = computed(() =>
  (props.item?.issues ?? []).filter(i => i.type === 'error' || i.type === 'warning'),
)

function originAndPath() {
  const url = checkStore.state.checkedUrl ?? ''
  try {
    const u = new URL(url)
    return { origin: u.origin, pathName: u.pathname }
  } catch {
    return { origin: null, pathName: null }
  }
}

function elementHintFor(item) {
  return item.href ?? item.src ?? item.url
      ?? item.title ?? item.text
      ?? item._meta?.selector
      ?? null
}

/** Open the dialog for a specific issue on this item (false-positive case). */
async function reportIssue(issue) {
  open.value = false
  const { origin, pathName } = originAndPath()
  const issueHash = await computeIssueHash(props.moduleId, props.item, issue)

  openReportDialog({
    scope:        'module_item',
    moduleId:     props.moduleId,
    origin,
    scopePath:    pathName,
    issueHash,
    issueType:    issue.type,
    issueMessage: issue.message,
    elementHint:  elementHintFor(props.item),
    title:        `[${props.moduleId}] ${issue.message}`,
  })
}

/** Open the dialog for the whole item — used when the item has no issues
 *  (false-negative: "this should be flagged but isn't"). */
async function reportItemWithoutIssue() {
  open.value = false
  const { origin, pathName } = originAndPath()
  const hint = elementHintFor(props.item)
  const issueHash = await computeIssueHash(props.moduleId, props.item, { type: 'info', message: '__false_negative__' })

  openReportDialog({
    scope:       'module_item',
    moduleId:    props.moduleId,
    origin,
    scopePath:   pathName,
    issueHash,
    issueType:   'false_negative',
    elementHint: hint,
    title:       hint ? `[${props.moduleId}] ${hint}` : `[${props.moduleId}] `,
  })
}

function onClick() {
  if (reportable.value.length === 0) {
    reportItemWithoutIssue()
    return
  }
  if (reportable.value.length === 1) {
    reportIssue(reportable.value[0])
    return
  }
  open.value = !open.value
}

const tooltipLabel = computed(() => {
  if (reportable.value.length === 0) return t('Report this item — should it have been flagged?')
  if (reportable.value.length === 1) return t('Report this finding')
  return t('Report a finding ({n} available)', { n: reportable.value.length })
})
</script>

<template>
  <div class="relative">
    <BaseButton
      :variant="reportable.length ? 'icon-error' : 'icon-alert'"
      :icon="reportable.length ? 'mdiBugOutline' : 'mdiFlagOutline'"
      :icon-size="13"
      :tooltip="tooltipLabel"
      @click.stop="onClick"
    />

    <!-- Backdrop closes the popover when clicked anywhere outside. -->
    <Teleport to="body">
      <Transition name="rib-fade">
        <div
          v-if="open"
          class="fixed inset-0 z-40"
          @click.stop="open = false"
        />
      </Transition>
    </Teleport>

    <Transition name="rib-fade">
      <div
        v-if="open"
        class="absolute top-7 right-0 z-50 w-72 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        @click.stop
      >
        <header class="px-3 py-2 border-b border-border/60 text-[11px] text-muted">
          {{ t('Which finding do you want to report?') }}
        </header>
        <ul>
          <li
            v-for="(iss, i) in reportable" :key="i"
            class="border-t border-border/30 first:border-t-0"
          >
            <button
              @click.stop="reportIssue(iss)"
              class="w-full px-3 py-2 flex items-start gap-2 hover:bg-surface-soft-hover transition-colors text-left"
            >
              <Icon
                :name="iss.type === 'error' ? 'mdiAlertCircle' : 'mdiAlertOutline'"
                :size="12"
                :class="iss.type === 'error' ? 'text-error shrink-0 mt-0.5' : 'text-alert shrink-0 mt-0.5'"
              />
              <span class="text-xs text-light leading-snug">{{ iss.message }}</span>
            </button>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rib-fade-enter-active,
.rib-fade-leave-active { transition: opacity .14s ease; }
.rib-fade-enter-from,
.rib-fade-leave-to     { opacity: 0; }
</style>
