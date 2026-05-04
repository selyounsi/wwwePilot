# Eigenen Service anlegen

Ein Service erscheint im Dashboard und im Burger-Menü. Du brauchst nur 2
Dateien — alles andere ist Auto-Discovery.

## Die 3 Schritte

### 1. Ordner + `service.json`

```
src/services/notes/service.json
```

```json
{
  "name":        "Notes",
  "description": "Page-spezifische Notizen",
  "icon":        "mdiNoteOutline"
}
```

`name` ist Pflicht. Der Rest ist optional.

### 2. `views/HomeView.vue`

```
src/services/notes/views/HomeView.vue
```

```vue
<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack />
    <div class="flex-1 px-4 py-4">
      {{ t('Hello, Notes') }}
    </div>
  </div>
</template>
```

`<AppHeader>` zieht Title + Description automatisch aus deiner `service.json`.

### 3. Reload + testen

```bash
npm run dev
```

In Chrome: `chrome://extensions/` → Reload-Button. **Service erscheint im
Dashboard.** Klicken → "Hello, Notes" zu sehen.

Fertig.

---

## Optional — nach Bedarf

| Was du willst | Datei | Mehr dazu |
|---|---|---|
| Deutsche Übersetzung | `translations/translations.json` | [i18n.md](./i18n.md) |
| Service-Settings (UI) | `views/SettingsView.vue` | siehe unten |
| Eigener State (z.B. Notizen) | `composables/useXxx.js` | [composables.md](./composables.md) |
| Sub-Pages | `views/MyView.vue` → `/service/notes/my` | Slug = Filename ohne `View` |
| Externe API-Calls | `background.js` | siehe unten |
| Mehrere austauschbare Sub-Funktionen | `modules/<id>/...` | [creating-a-module.md](./creating-a-module.md) |

### Settings-Page (Kurzfassung)

```vue
<!-- views/SettingsView.vue -->
<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
const { t } = useI18n()
</script>

<template>
  <ServiceSettingsPage>
    <!-- deine Settings-Felder hier -->
  </ServiceSettingsPage>
</template>
```

Erscheint automatisch unter `/settings` und im Burger-Menü.

### Background-Handler (Kurzfassung)

```js
// background.js
export const types = ['NOTES_FETCH']

export async function handle(msg, sendResponse) {
  if (msg.type === 'NOTES_FETCH') {
    const data = await fetch(msg.url).then(r => r.json())
    sendResponse({ data })
  }
}
```

Aufrufen aus dem Sidebar-Code:

```js
chrome.runtime.sendMessage({ type: 'NOTES_FETCH', url: '...' }, r => { ... })
```

---

## Wenn was nicht funktioniert

| Symptom | Meist dran |
|---|---|
| Service taucht nicht auf | `service.json` fehlt, oder `views/HomeView.vue` fehlt, oder `"active": false` |
| Header ohne Title | `name` in `service.json` vergessen |
| Settings-Page nicht da | Datei muss `views/SettingsView.vue` heißen (Pascal-Case) |

## Weiter

- [creating-a-module.md](./creating-a-module.md) — Module für deinen Service
- [composables.md](./composables.md) — was du wiederverwenden kannst
