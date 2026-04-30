# Neuen Service erstellen

Ein Service ist ein Top-Level-Bereich der Extension (z.B. der Web-Checker oder
der Chatbot). Erscheint im Dashboard und im Burger-Menü.

> Lies erst [architecture.md](./architecture.md) für den Überblick.

## Minimaler Service (Pflicht)

```
src/services/mein-service/
├── service.json
└── views/HomeView.vue
```

### `service.json`

```json
{
  "name":        "My Service",
  "description": "Kurze Beschreibung",
  "icon":        "mdiRocket",
  "active":      true,
  "order":       5
}
```

| Key | Pflicht | Default | Bedeutung |
|---|---|---|---|
| `name` | ✓ | — | Anzeigename (Translation-Key) |
| `description` | | `''` | Kurzbeschreibung (Translation-Key) |
| `icon` | | `''` | MDI-Icon ([pictogrammers.com/library/mdi](https://pictogrammers.com/library/mdi/)) |
| `active` | | `true` | `false` = ausblenden, ohne zu löschen |
| `order` | | `Infinity` | Sortierung im Dashboard |

### `views/HomeView.vue`

```vue
<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />
    <div class="flex-1 px-4 py-4">
      <p>{{ t('Hello, world') }}</p>
    </div>
  </div>
</template>
```

`<AppHeader>` zieht Title + Subtitle automatisch aus `route.meta` (kommt aus
deiner `service.json`). Beide laufen durch `t()`.

**Fertig** — Service erscheint im Dashboard und im Burger-Menü. Keine
Router-Config, keine Loader-Eintragung.

---

## Optional

| Datei | Zweck |
|---|---|
| `views/SettingsView.vue` | Service-Settings; auto-verlinkt unter `/settings` und im Burger → Einstellungen |
| `views/*View.vue` | Weitere Sub-Seiten unter `/service/<id>/<kebab-name>` |
| `composables/use*.js` | Service-eigener State (Store, Watcher, ...) |
| `components/*.vue` | Service-eigene Komponenten |
| `translations/translations.json` | Übersetzungen (siehe [i18n.md](./i18n.md)) |
| `background.js` | Service-Worker-Handler (`export const types`, `export async function handle`) |
| `modules/<id>/` | Auto-entdeckte Module ([creating-a-module.md](./creating-a-module.md)) |
| `README.md` | Was tut der Service, welche Module gibt's |

## Service-Settings

Wenn dein Service Settings braucht:

```vue
<!-- views/SettingsView.vue -->
<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
const { t } = useI18n()
</script>

<template>
  <ServiceSettingsPage>
    <!-- service-spezifische Settings hier -->
    <div class="bg-surface-soft border border-border rounded-xl ...">
      ...
    </div>
  </ServiceSettingsPage>
</template>
```

`<ServiceSettingsPage>` rendert AppHeader, deinen Slot-Inhalt, und hängt
**automatisch** unten dran eine Liste aller Module-Settings (für jedes Modul
mit `views/SettingsView.vue`). Du musst da nichts manuell aggregieren.

Service-Settings persistieren typischerweise in `chrome.storage.local`. Ein
Composable-Pattern dafür:

```js
// composables/useMyServiceSettings.js
import { reactive, watch } from 'vue'

const STORAGE_KEY = 'wp-my-service-settings'
const state = reactive({ /* ... */ })

let hydrated = false
function hydrate() {
  if (hydrated) return
  hydrated = true
  chrome.storage?.local?.get(STORAGE_KEY).then(r => {
    Object.assign(state, r[STORAGE_KEY] ?? {})
  })
}

let watching = false
function startWatch() {
  if (watching) return
  watching = true
  watch(state, () => chrome.storage?.local?.set({ [STORAGE_KEY]: { ...state } }), { deep: true })
}

export function useMyServiceSettings() {
  hydrate()
  startWatch()
  return { state }
}
```

## Sub-Views

Jede `*View.vue` (außer `HomeView.vue` und `SettingsView.vue`) bekommt
automatisch eine Route unter `/service/<id>/<kebab-name>`. Beispiel:
`MyDashboardView.vue` → `/service/<id>/my-dashboard`.

Genutzt im Web-Checker für `SiteCheckView.vue` (`→ /service/web-checker/site-check`).

## Background-Handler

```js
// background.js
export const types = ['MY_FETCH', 'MY_OTHER']

export async function handle(msg, sendResponse, sender) {
  switch (msg.type) {
    case 'MY_FETCH': {
      const data = await fetch(msg.url).then(r => r.json())
      sendResponse({ data })
      break
    }
    case 'MY_OTHER': /* ... */
  }
}
```

Auto-loaded vom `src/background.js`. Aufruf aus dem Sidebar-Code:

```js
chrome.runtime.sendMessage({ type: 'MY_FETCH', url: '...' }, response => { ... })
```

## BreadCrumb

Funktioniert automatisch:

```
Dashboard › Mein Service                                  ← /service/mein-service
Dashboard › Einstellungen › Mein Service                   ← /service/mein-service/settings
Dashboard › Einstellungen › Mein Service › Mein Modul     ← /service/mein-service/module/mein-modul/settings
```

## Tipps

- **Strings durch `t()`** — keine deutschen Hartcodings. Service-spezifische
  Strings landen in `translations/translations.json`. Siehe [i18n.md](./i18n.md).
- **Service-Name + Description** stehen in `service.json` auf Englisch (= Key);
  die DE-Übersetzung in der Service-`translations.json`.
- **README pro Service** — was tut er, welche Module/Provider gibt's,
  Verweis auf die wichtigsten Composables.
- **Module nutzen, wenn die Logik unterschiedlich austauschbar sein soll** —
  z.B. Chatbot-Provider oder Web-Checker-Prüfungen. Sonst reicht eine
  HomeView + Composables.
