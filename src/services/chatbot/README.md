# KI-Assistent (Chatbot)

Chat-Interface mit Provider-Toggle. Provider sind eigenständige Module unter
`modules/<id>/` — austauschbar, ohne dass die Service-Logik (Verlauf,
Input-Layout, Verlaufs-Verwaltung) angefasst werden muss.

## Aktuelle Provider

| Provider | Modul | Logik |
|---|---|---|
| **wwwe** | [`modules/wwwe/`](modules/wwwe/) | `fetch` an die wwwe-Chat-API (Backend, Default `localhost:3000`). Antwortet auf Working-Guide- und Projekttypen-Fragen. |
| **Claude** | [`modules/claude/`](modules/claude/) | `fetch` an Anthropics API mit eigenem API-Key. Key wird über die Modul-Settings-Page gesetzt — kein Modal mehr. |

Toggle oben unter dem AppHeader wechselt zwischen den Providern. Jeder Provider
hat seinen eigenen Verlauf (per Chat-Sammlung in `localStorage`).

## Provider-Modul-Vertrag

Ein Provider-Modul exportiert:

```js
// modules/<id>/index.js
export const accentColor = '#bad32c'           // Avatar-Farbe (CSS-Wert oder var())
export const welcomeText = 'Ask me about ...'  // Translation-Key
export const suggestions = ['What is X?', ...] // Translation-Keys

export default async function send({ text, history, chatId }) {
  // ... API-Call ...
  return { reply: '...' }   // oder { error: '...' }
}
```

Plus eine `views/Index.vue` für den Empty-State (Avatar + Welcome + Suggestions
+ provider-spezifische Banner — z.B. "API-Key fehlt" bei Claude). Die wird in
`HomeView.vue` als `<component :is="activeModule.view" />` eingebettet, sobald
der Chat-Verlauf leer ist.

Provider-eigene Settings (z.B. Claude-API-Key) gehen in
`modules/<id>/views/SettingsView.vue` und tauchen automatisch unter den
Service-Einstellungen auf — `<ServiceSettingsPage>` aggregiert via Glob.

## Neuen Provider hinzufügen

1. `modules/<id>/module.json` mit `id`, `name`, `icon`, `order`
2. `modules/<id>/index.js` mit `send`-Default-Export + `accentColor`/`welcomeText`/`suggestions`
3. `modules/<id>/views/Index.vue` für Empty-State
4. Optional: `views/SettingsView.vue`, `background.js`, `composables/`,
   `translations/translations.json`

Toggle-Button erscheint automatisch (iteriert via `useChat.modules`), eigener
Verlauf wird automatisch angelegt. Voller Step-by-Step-Guide:
[docs/creating-a-module.md](../../../docs/creating-a-module.md).

## Verwandte Files

| Datei | Zweck |
|---|---|
| `composables/useChat.js` | Chat-Store, Verlauf, generischer `send()`-Aufruf des aktiven Provider-Moduls |
| `views/HomeView.vue` | Layout: AppHeader + ProviderToggle + Messages + Input |
| `views/SettingsView.vue` | leerer `<ServiceSettingsPage />`-Wrapper (Modul-Settings füllen sich automatisch) |
| `components/ProviderToggle.vue` | Toggle-Bar, iteriert über alle aktiven Module |

Composables-Übersicht über alle Services: [docs/composables.md](../../../docs/composables.md).

## Hinweis: Verlaufs-Speicher

Verlauf liegt in `localStorage` unter `${APP_NAME_LOWER}-chats-v2` als Map
`{ [providerId]: Chat[] }`. Beim ersten Laden je Provider: ein leerer Chat. Das
Modul-System ist dynamisch — entfernt man einen Provider, bleiben dessen Chats
in `localStorage` (werden ignoriert). Neuer Provider bekommt automatisch einen
ersten Chat.
