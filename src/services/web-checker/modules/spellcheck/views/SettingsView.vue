<script setup>
import { ref } from 'vue'
import { useI18n }            from '@/composables/i18n/useI18n.js'
import { useModuleSettings } from '@/composables/settings/useModuleSettings.js'

const { t } = useI18n()
const settings = useModuleSettings('spellcheck', { ignoreWords: [] })

const newWord = ref('')

function add() {
  const w = newWord.value.trim()
  if (!w) return
  if (settings.ignoreWords.includes(w)) { newWord.value = ''; return }
  settings.ignoreWords = [...settings.ignoreWords, w]
  newWord.value = ''
}

function remove(word) {
  settings.ignoreWords = settings.ignoreWords.filter(w => w !== word)
}
</script>

<template>
  <div class="min-h-full bg-background flex flex-col">
    <AppHeader showBack :subtitle="t('Settings')" />

    <div class="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

      <section class="flex flex-col gap-2">
        <SectionLabel>{{ t('Ignore words') }}</SectionLabel>

        <div class="bg-surface-soft border border-border rounded-xl px-3 py-3 flex flex-col gap-3">
          <p class="text-[11px] text-muted leading-snug">
            {{ t('Words listed here are skipped by the spellchecker. Useful for brand names, technical terms or proper nouns.') }}
          </p>

          <form @submit.prevent="add" class="flex gap-2">
            <input
              v-model="newWord"
              type="text"
              :placeholder="t('e.g. wwwe, Anthropic, Schönfeldt')"
              class="flex-1 bg-surface border border-border text-light text-xs rounded-lg px-3 py-2 outline-none focus:border-primary/50 placeholder:text-muted/40 font-mono"
            />
            <button
              type="submit"
              :disabled="!newWord.trim()"
              class="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              :class="newWord.trim()
                ? 'bg-primary text-black/80 hover:opacity-90'
                : 'bg-surface-soft text-muted/40 cursor-not-allowed'"
            >
              <Icon name="mdiPlus" :size="14" />
            </button>
          </form>

          <div v-if="settings.ignoreWords.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="word in settings.ignoreWords" :key="word"
              class="inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg pl-2.5 pr-1 py-1"
            >
              <span class="text-xs font-mono text-light">{{ word }}</span>
              <button
                @click="remove(word)"
                class="text-muted/50 hover:text-error transition-colors"
                :title="t('Remove')"
              >
                <Icon name="mdiClose" :size="12" />
              </button>
            </span>
          </div>
          <p v-else class="text-[11px] text-muted/60 italic">
            {{ t('No words yet.') }}
          </p>
        </div>
      </section>

    </div>
  </div>
</template>
