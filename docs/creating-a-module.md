# Neues Modul erstellen

Ein Modul ist eine eigenständige Einheit innerhalb eines Service. Im Web-Checker
ist das eine Prüfung; im Chatbot ein Provider. Diese Anleitung deckt beides ab.

> Lies erst [architecture.md](./architecture.md) für das große Bild und
> [module-api.md](./module-api.md) als API-Referenz.

## Verzeichnis-Struktur

```
src/services/<service>/modules/<id>/
├── module.json                ← Pflicht: id, name, icon, active
├── index.js                   ← Pflicht: Default-Export (Logik)
├── views/
│   ├── Index.vue              ← Pflicht: Sidebar-Page für das Modul
│   └── SettingsView.vue       ← optional: Modul-spezifische Settings
├── components/                ← optional: Item-Renderer etc.
├── composables/               ← optional: Modul-eigene Composables
├── translations/translations.json   ← optional: Modul-Übersetzungen
├── background.js              ← optional: SW-Handler
└── README.md                  ← optional: Was prüft das Modul
```

Auto-Discovery: sobald `module.json`, `index.js` und `views/Index.vue` existieren,
taucht das Modul automatisch auf — kein Code-Update nötig.

---

## Web-Checker-Modul (DOM-Prüfung)

### 1. `module.json`

```json
{
  "id":            "my-check",
  "name":          "My Check",
  "description":   "Was prüft das Modul",
  "icon":          "mdiCheck",
  "active":        true,
  "order":         50,
  "checkOnReload": false,
  "allowChatBot":  true,
  "defaultFilter": "issues"
}
```

| Key | Pflicht | Default | Bedeutung |
|---|---|---|---|
| `id` | ✓ | — | kebab-case, eindeutig |
| `name` | ✓ | — | Anzeigename (Translation-Key) |
| `description` | | `''` | Kurzbeschreibung im Dashboard |
| `icon` | | `''` | MDI-Icon (camelCase) |
| `active` | | `true` | `false` = ausblenden |
| `order` | | `Infinity` | Sortierreihenfolge |
| `checkOnReload` | | `false` | Auto-Recheck beim Tab-Reload (`useTabWatcher`) |
| `allowChatBot` | | `false` | "Im Chat analysieren"-Button auf Items |
| `defaultFilter` | | `'issues'` | `'all'` / `'issues'` / `'errors'` / `'warnings'` |
| `singlePage`, `fullSite` | | `{}` | Pfad-Filter, siehe unten |

#### Pfad-Filter

```json
"singlePage": { "runOnPaths": ["/", "/impressum"], "skipOnPaths": ["/checkout"] },
"fullSite":   { "runOnPaths": [], "skipOnPaths": [] }
```

- Exakte Matches gegen `URL.pathname`, Trailing-Slash wird normalisiert
- `skipOnPaths` gewinnt
- Fehlt der Block oder beide Listen leer → Modul läuft überall in dem Modus

### 2. `index.js` — Checker

Läuft im **Page-Kontext** (DOM der geprüften Seite). Wird via `Function.toString()`
serialisiert — keine Modulebene-Imports!

```js
export const overlay = null   // oder OverlayConfig (siehe module-api.md)

export default function check() {
  const t = window.__t   // Übersetzungsfunktion
  const { addItem, finish } = createCheckResult()

  document.querySelectorAll('h1').forEach((h, idx) => {
    const text = (h.innerText || '').trim()
    addItem(h, [
      { when: !text,            type: 'error',   title: t('H1 is empty') },
      { when: text.length < 10, type: 'warning', title: t('H1 too short: "{text}"', { text }) },
      { when: true,             type: 'success', title: text },
    ], {
      tag: h.tagName, text,
      _meta: { tag: 'H1', idx },   // Pflicht für Overlay/Highlight
    })
  })

  return finish()
}
```

**Window-Helper** im Page-Kontext (vor jedem Run injiziert):
- `createCheckResult()`, `setHighlightElement()`, `isElementVisible(el)`,
  `hasVisualContent(el)`, `runInBackground(type, payload)` — alle in [module-api.md](./module-api.md)
- `__t(key, params)` — Übersetzung, [i18n.md](./i18n.md)
- `__ignoreSelectors` — globale Ignore-Selektoren-Array
- `__moduleSettings.<id>` — Snapshot der eigenen Modul-Settings

### 3. `views/Index.vue`

```vue
<script setup>
import MyItem from '../components/MyItem.vue'
</script>
<template>
  <ModulePage moduleId="my-check" label="My Check" :itemComponent="MyItem" />
</template>
```

`<ModulePage>` macht AppHeader, Idle/Running/Done-States, Stats-Header und die
Items-Schleife. Für custom Rendering den Default-Slot überschreiben.

### 4. `components/MyItem.vue`

```vue
<script setup>
import { computed } from 'vue'
const props = defineProps({ item: Object })
const normalized = computed(() => ({ ...props.item, title: props.item.text || props.item.tag }))
</script>
<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <DetailRow label="Tag">{{ item.tag }}</DetailRow>
      <DetailRow v-if="item.text" label="Text">{{ item.text }}</DetailRow>
    </template>
  </ModuleItem>
</template>
```

### 5. (optional) `background.js` — wenn der Checker einen SW-Handler braucht

```js
export const type = 'MY_CHECK_FETCH'

export async function handle(msg, sendResponse, sender) {
  try {
    const data = await fetch(msg.url).then(r => r.json())
    sendResponse({ data })
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
```

Im Checker:
```js
const reply = await runInBackground('MY_CHECK_FETCH', { url: 'https://...' })
```

### 6. (optional) `views/SettingsView.vue` — Modul-Settings

```vue
<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useModuleSettings } from '@/composables/settings/useModuleSettings.js'

const { t } = useI18n()
const settings = useModuleSettings('my-check', { ignoreList: [] })
const newItem = ref('')

function add() {
  if (!newItem.value.trim()) return
  settings.ignoreList = [...settings.ignoreList, newItem.value.trim()]
  newItem.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack :subtitle="t('Settings')" />
    <div class="flex-1 px-4 py-4">
      <!-- ... -->
    </div>
  </div>
</template>
```

Settings persistieren automatisch in `chrome.storage.local` unter
`wp-module-settings`. Im Checker zugänglich als
`window.__moduleSettings['my-check'].ignoreList`.

Erscheint automatisch unter Service-Einstellungen, sofern der Service
`<ServiceSettingsPage>` benutzt.

---

## Chatbot-Provider-Modul

Provider sind Module unter `services/chatbot/modules/<id>/`. Vertrag:

```js
// modules/<id>/index.js
export const accentColor = '#bad32c'           // Avatar-Farbe (CSS-Wert oder var())
export const welcomeText = 'Ask me about ...'  // Translation-Key
export const suggestions = ['What is X?', 'How do Y?']

export default async function send({ text, history, chatId }) {
  // ... API-Call ...
  return { reply: '...' }   // oder { error: '...' }
}
```

`views/Index.vue` rendert den Empty-State (Avatar mit `accentColor`, welcome,
Suggestions). Wird in `chatbot/views/HomeView.vue` als
`<component :is="activeModule.view" />` eingebettet, wenn der Verlauf leer ist.

Toggle-Button erscheint automatisch via `useChat`-Loop über alle Module. Eigener
Verlauf wird automatisch angelegt.

Beispiele: `services/chatbot/modules/wwwe/` und `services/chatbot/modules/claude/`.

---

## Konventionen

- `index.js` (klein) für Logik, `Index.vue` (groß) für die View — Vite
  unterscheidet die Schreibweise
- Strings durch `t()` (Vue) bzw. `window.__t()` (Checker) — keine deutschen
  Hartcodings, siehe [i18n.md](./i18n.md)
- `_meta` in jedem Item setzen — sonst funktionieren Overlays/Highlight nicht
- Helper innerhalb der `check()`-Funktion definieren oder via `apiConfig`-Export
  durchreichen
- README pro Modul: was/warum/Limitierungen

## Häufige Stolperfallen

- **Imports in der Checker-Funktion** — gehen verloren bei Serialisierung. Pack
  alles inline oder ins `apiConfig`.
- **Vergessenes `_meta`** — Overlays leuchten nicht auf, Klicks scrollen nicht.
- **`Index.vue` im Modul-Root statt in `views/`** — Loader findet die View nicht
  und gibt Console-Warning. Immer `views/Index.vue`.
- **Modul-Settings nicht im Page-Kontext** — `injectHelper` wird vom Web-Checker
  `useCheckRunner` aufgerufen. Bei nicht-Web-Checker-Services müssen Settings
  selbst durchgereicht werden.

## Siehe auch

- [module-api.md](./module-api.md) — vollständige API-Referenz (alle Window-Helper, alle Vue-Komponenten)
- [i18n.md](./i18n.md) — Übersetzungssystem
- [creating-a-service.md](./creating-a-service.md) — neuen Service anlegen
