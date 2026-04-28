<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ item: Object, domain: String })
const emit  = defineEmits(['ignore', 'addWord'])

const loading    = ref(false)
const done       = ref(null)
const confirming = ref(null)

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.fehler?.trim() || props.item.category || 'Fehler',
  details: props.item.context,
}))

const canIgnore  = computed(() => !props.item.isSeo)
const canAddWord = computed(() => !props.item.isSeo && !!props.item.fehler?.trim())

async function ignore() {
  loading.value = true
  await new Promise(r => chrome.runtime.sendMessage(
    { type: 'SPELL_IGNORE_ADD', domain: props.domain, error_text: props.item.fehler }, r
  ))
  loading.value    = false
  confirming.value = null
  done.value       = 'ignored'
  emit('ignore', props.item)
}

async function addToDict() {
  loading.value = true
  await new Promise(r => chrome.runtime.sendMessage(
    { type: 'SPELL_DICT_ADD', domain: props.domain, word: props.item.fehler }, r
  ))
  loading.value    = false
  confirming.value = null
  done.value       = 'added'
  emit('addWord', props.item)
}
</script>

<template>
  <div :class="done ? 'opacity-40' : ''">
    <ModuleItem :item="normalized" variant="box">
      <template #expand>
        <div class="bg-surface-soft border-t border-border/40 px-3 py-3 flex flex-col gap-3">

          <p class="text-xs text-muted leading-relaxed">{{ item.message }}</p>

          <div v-if="item.context" class="text-xs bg-background border border-border rounded-lg px-3 py-2 leading-relaxed text-muted font-mono">
            {{ item.context }}
          </div>

          <div v-if="item.suggestions?.length" class="flex flex-col gap-1">
            <p class="text-xs text-muted uppercase tracking-widest">Vorschläge</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="s in item.suggestions.slice(0, 6)" :key="s"
                class="text-xs bg-success/10 text-success border border-success/20 rounded-lg px-2 py-1 cursor-default"
              >{{ s }}</span>
            </div>
          </div>

          <a
            v-if="item.fehler?.trim()"
            :href="`https://www.google.com/search?q=${encodeURIComponent(item.fehler)}`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 text-xs text-muted/50 hover:text-muted transition-colors self-start"
          >
            <Icon name="mdiMagnify" :size="12" />
            „{{ item.fehler }}" googeln
          </a>

          <div v-if="!done && (canIgnore || canAddWord)" class="flex flex-col gap-2">

            <div v-if="confirming" class="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
              <p class="flex-1 text-xs text-muted">
                {{ confirming === 'add' ? `„${item.fehler}" zum Wörterbuch hinzufügen?` : `Fehler dauerhaft ignorieren?` }}
              </p>
              <button
                @click="confirming === 'add' ? addToDict() : ignore()"
                :disabled="loading"
                class="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40"
              >
                <Icon name="mdiCheck" :size="12" />
                Ja
              </button>
              <button
                @click="confirming = null"
                class="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-surface border border-border text-muted hover:bg-surface-soft-hover transition-colors"
              >
                <Icon name="mdiClose" :size="12" />
                Nein
              </button>
            </div>

            <div v-else class="flex gap-2">
              <button
                v-if="canAddWord"
                @click="confirming = 'add'"
                class="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <Icon name="mdiBookPlusOutline" :size="13" />
                Zum Wörterbuch
              </button>
              <button
                v-if="canIgnore"
                @click="confirming = 'ignore'"
                class="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-surface border border-border text-muted hover:bg-surface-soft-hover transition-colors"
              >
                <Icon name="mdiEyeOffOutline" :size="13" />
                Ignorieren
              </button>
            </div>

          </div>

          <p v-else-if="done" class="flex items-center justify-center gap-1 text-xs text-center text-muted">
            <Icon name="mdiCheck" :size="13" />
            {{ done === 'added' ? 'Zum Wörterbuch hinzugefügt' : 'Ignoriert' }}
          </p>

        </div>
      </template>
    </ModuleItem>
  </div>
</template>
