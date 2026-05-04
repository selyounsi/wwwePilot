# Eigenes Modul anlegen

Ein Web-Checker-Modul ist eine Prüfung. Du brauchst 3 Dateien — alles andere
ist Auto-Discovery.

> Chatbot-Provider sind ein anderer Vertrag, [siehe unten](#chatbot-provider).

## Die 4 Schritte

### 1. Ordner + `module.json`

```
src/services/web-checker/modules/buttons/module.json
```

```json
{
  "id":            "buttons",
  "name":          "Buttons",
  "description":   "Find buttons without a label",
  "icon":          "mdiGestureTapButton",
  "allowChatBot":  true,
  "defaultFilter": "issues"
}
```

`id` und `name` sind Pflicht. Der Rest ist optional —
[volle Feld-Liste](./module-api.md#modulejson).

### 2. `index.js` — die Prüfung

```js
// src/services/web-checker/modules/buttons/index.js
export const overlay = null

export default function check() {
  const t = window.__t
  const { addItem, finish } = createCheckResult()

  document.querySelectorAll('button').forEach((btn, idx) => {
    const text = (btn.innerText || btn.getAttribute('aria-label') || '').trim()
    addItem(btn, [
      { when: !text, type: 'error',   title: t('Button without label') },
      { when: true,  type: 'success', title: text },
    ], {
      tag: 'BUTTON',
      text,
      _meta: { tag: 'BUTTON', idx },   // Pflicht für Highlight/Overlay
    })
  })

  return finish()
}
```

> ⚠️ **Keine `import`s außerhalb der Funktion** — der Code wird via
> `Function.toString()` an die Seite geschickt. Helper inline definieren.

`window.__t` ist die Übersetzungsfunktion, `createCheckResult` ein Helper aus
dem Page-Kontext. Volle Liste: [module-api.md](./module-api.md).

### 3. `views/Index.vue`

```vue
<!-- src/services/web-checker/modules/buttons/views/Index.vue -->
<template>
  <ModulePage moduleId="buttons" label="All Buttons" />
</template>
```

`<ModulePage>` macht AppHeader, Idle/Running/Done-States, Stats und Item-Liste
für dich.

### 4. Reload + testen

```bash
npm run dev
```

In Chrome: Extension reloaden, Sidebar öffnen, Web-Checker → "Prüfung starten".
**Dein Modul erscheint in der Liste.** Klick drauf → Items mit Default-
Renderer.

Fertig.

---

## Optional — nach Bedarf

| Was du willst | Datei | Mehr dazu |
|---|---|---|
| Eigenes Item-Layout (Detail-Expand) | `components/MyItem.vue` + `:itemComponent="MyItem"` in der Index.vue | siehe unten |
| Modul-Settings | `views/SettingsView.vue` mit `useModuleSettings('buttons', defaults)` | siehe unten |
| Externe API-Calls | `background.js` mit `runInBackground('TYPE', payload)` im Checker | [creating-a-service.md](./creating-a-service.md#background-handler-kurzfassung) |
| Übersetzung | `translations/translations.json` | [i18n.md](./i18n.md) |
| Klickbares Overlay-Badge auf der Seite | `export const overlay = { ... }` | [module-api.md → OverlayConfig](./module-api.md) |
| Springt im Live-Editor zum CMS-Element | passiert automatisch wenn `_meta` gesetzt + Element ein bekannter CMS4-Typ ist | [composables.md → useLiveEditorBridge](./composables.md#liveeditoruseliveeditorbridgejs) |

### Eigene Item-Komponente (Kurzfassung)

```vue
<!-- components/ButtonItem.vue -->
<script setup>
const props = defineProps({ item: Object })
</script>

<template>
  <ModuleItem :item="{ ...item, title: item.text || '(no label)' }" variant="box">
    <template #expand>
      <DetailRow label="Tag">{{ item.tag }}</DetailRow>
    </template>
  </ModuleItem>
</template>
```

Im `Index.vue`: `<ModulePage … :itemComponent="ButtonItem" />`.

### Modul-Settings (Kurzfassung)

```vue
<!-- views/SettingsView.vue -->
<script setup>
import { useModuleSettings } from '@/composables/settings/useModuleSettings.js'
const settings = useModuleSettings('buttons', { minLength: 1 })
</script>

<template>
  <input v-model.number="settings.minLength" type="number" min="1" />
</template>
```

Im Checker zugänglich: `window.__moduleSettings.buttons.minLength`. Persistenz
ist automatisch.

---

## Wenn was nicht funktioniert

| Symptom | Meist dran |
|---|---|
| Modul taucht nicht auf | `module.json` oder `views/Index.vue` fehlt, oder `"active": false` |
| Items werden gerendert, aber Klick scrollt nicht | `_meta` fehlt oder hat falsche Form (`{tag, idx}` für DOM-Elemente) |
| Page-Kontext-Code wirft `ReferenceError` | Du hast `import`s außerhalb der `check()`-Funktion |
| Settings sind im Checker `undefined` | `useModuleSettings()` mit gleichem `id` muss in `views/SettingsView.vue` aufgerufen worden sein |

## Chatbot-Provider

Anderes Service, anderer Vertrag — kürzer:

```js
// src/services/chatbot/modules/myprovider/index.js
export const accentColor = '#bad32c'
export const welcomeText = 'Ask me about ...'
export const suggestions = ['What is X?']

export default async function send({ text, history, chatId }) {
  // ... API-Call ...
  return { reply: '...' }   // oder { error: '...' }
}
```

Plus `views/Index.vue` für den Empty-State. Vorlagen:
[`chatbot/modules/wwwe/`](../src/services/chatbot/modules/wwwe/),
[`chatbot/modules/claude/`](../src/services/chatbot/modules/claude/).

## Weiter

- [module-api.md](./module-api.md) — alle Window-Helper, Item-Shapes
- Existierende Module als Vorlagen: `headings/` (einfach), `images/` (mit
  Item-Component), `spellcheck/` (mit Backend + Settings)
