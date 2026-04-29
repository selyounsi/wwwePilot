# Ein neues Modul erstellen

Schritt-für-Schritt-Anleitung zum Hinzufügen einer neuen Prüfung im Web Checker.

> Lies zuerst [architecture.md](./architecture.md) für das große Bild und nutze
> dann diese Anleitung als praktisches Rezept.

## Schnellrezept (kein Service Worker nötig)

Für eine Prüfung, die nur das DOM durchwandert und keinen Netzwerkzugriff braucht.

### 1. Verzeichnis anlegen

```
src/services/web-checker/modules/<your-id>/
├── module.json
├── index.js
├── Index.vue
└── components/
    └── YourItem.vue
```

Der Verzeichnisname muss nicht mit `<your-id>` übereinstimmen, aber die Konvention
sorgt für Ordnung.

### 2. `module.json`

```json
{
  "id":            "my-check",
  "name":          "Mein Check",
  "description":   "Was prüft das Modul",
  "icon":          "mdiCheck",
  "active":        true,
  "order":         50,
  "checkOnReload": false,
  "allowChatBot":  true,
  "defaultFilter": "issues"
}
```

| Key | Bedeutung |
|---|---|
| `id` | Interner Bezeichner — muss eindeutig sein, kebab-case |
| `name` | Anzeigename im Dashboard / auf der Modul-Seite |
| `description` | Einzeiler-Untertitel im Dashboard |
| `icon` | MDI-Icon-Name von [pictogrammers.com/library/mdi](https://pictogrammers.com/library/mdi/) |
| `active` | Auf `false` setzen, um das Modul auszublenden, ohne es zu löschen |
| `order` | Sortierreihenfolge im Dashboard (kleiner = früher) |
| `checkOnReload` | Automatisch erneut ausführen, wenn die Seite neu geladen wird |
| `allowChatBot` | "Im Chat analysieren"-Button auf den Items anzeigen |
| `defaultFilter` | Initialer Filter: `'issues'` / `'errors'` / `'warnings'` / `'all'` |

### 3. `index.js` — der Checker

```js
export const overlay = null   // oder ein Konfigurationsobjekt — siehe unten

export default function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  document.querySelectorAll('h1').forEach((h, idx) => {
    const text = (h.innerText || '').trim()

    addItem(h, [
      { when: !text,        type: 'error',   title: 'H1 ist leer' },
      { when: text.length < 10, type: 'warning', title: `H1 zu kurz: "${text}"` },
      { when: true,         type: 'success', title: text },
    ], {
      tag:  h.tagName,
      text,
      _meta: { tag: 'H1', idx },   // damit Overlays/Highlight es später finden können
    })
  })

  return finish()
}
```

Diese Funktion läuft im **Page-Kontext** der zu prüfenden Webseite. Das bedeutet:

- ✅ Du hast vollen DOM-Zugriff via `document`, `window`, `getComputedStyle`,
  `XMLHttpRequest`, `fetch`, `chrome.runtime.sendMessage`, …
- ❌ Du **kannst keine** Imports auf Modulebene verwenden — alles außerhalb des
  `check()`-Funktionskörpers geht verloren, wenn die Funktion serialisiert wird
- ❌ Du **kannst keine** Bundler-Features wie `import.meta.env` nutzen

Wenn du eine Konstante brauchst, deklariere sie **innerhalb** von `check()`. Wenn
du eine Hilfsfunktion brauchst, deklariere sie ebenfalls innerhalb von `check()`.

Das Framework injiziert ein paar nützliche Helper als `window.*`-Globals, bevor
dein Checker läuft (siehe [module-api.md](./module-api.md) für die vollständige Liste):

- `createCheckResult()` — wie oben gezeigt
- `setHighlightElement()` — gibt eine UUID zurück, die du normalerweise nicht
  selbst aufrufen musst; `addItem` macht das für dich
- `isElementVisible(el)` — rekursive Sichtbarkeitsprüfung
- `hasVisualContent(el)` — erkennt Icon-gestylte leere Elemente
- `runInBackground(type, payload)` — ruft einen Service-Worker-Handler auf

### 4. `Index.vue` — die Sidebar-Seite

```vue
<script setup>
import YourItem from './components/YourItem.vue'
</script>

<template>
  <ModulePage moduleId="my-check" label="Mein Check" :itemComponent="YourItem" />
</template>
```

Das war's. `<ModulePage>` kümmert sich um AppHeader, idle / running / done-States,
ModuleStats und die Items-Schleife.

Für komplexere Views überschreibst du den Default-Slot:

```vue
<template>
  <ModulePage moduleId="my-check" label="Mein Check">
    <template #default="{ result, raw }">
      <CustomStats :result="raw ?? result" />
      <YourGroupedView :items="result.items" />
    </template>
  </ModulePage>
</template>
```

### 5. `components/YourItem.vue` — Anzeige pro Item

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.text || props.item.tag,
  details: '',
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">
        <DetailRow label="Tag">{{ item.tag }}</DetailRow>
        <DetailRow v-if="item.text" label="Text">{{ item.text }}</DetailRow>
      </div>
    </template>
  </ModuleItem>
</template>
```

### 6. Fertig

Dein Modul taucht automatisch im Dashboard auf — kein Router-Setup, keine
Loader-Registrierung. Vite findet es via `import.meta.glob`.

---

## Rezept: Modul, das einen Service Worker braucht

Verwende dies, wenn deine Prüfung `chrome.tabs.captureVisibleTab`, `fetch` zu
externen APIs ohne CORS-Probleme, persistenten Speicher oder irgendetwas anderes
braucht, das den Service-Worker-Kontext erfordert.

### `background.js` hinzufügen

```js
export const type = 'MY_CHECK_FETCH'

export async function handle(msg, sendResponse, sender) {
  // sender.tab.id ist der Tab, von dem der Aufruf stammt
  try {
    const data = await fetch(msg.url).then(r => r.json())
    sendResponse({ data })
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
```

### Aufruf aus deinem Checker

```js
export default async function check() {
  const reply = await runInBackground('MY_CHECK_FETCH', { url: 'https://api.example.com' })

  if (reply?.error) {
    return { errors: [{ message: reply.error }], warnings: [], errorCount: 1, warningCount: 0, items: [] }
  }

  const { addItem, finish } = createCheckResult()
  // ...nutze reply.data...
  return finish()
}
```

Der Auto-Loader des Frameworks erkennt jede `background.js`-Datei in
`services/*/modules/*/background.js` und registriert sie über ihren exportierten
`type`. Keine Manifest-Anpassungen nötig.

---

## Rezept: Modul mit Overlay-Badges

Füge einen `overlay`-Export mit einer `labelFn` hinzu:

```js
export const overlay = {
  enabled: true,
  labelFn: (item) => item.text ? `Text: ${item.text}` : '⚠ Kein Text',
  onText:  'Ausblenden',
  offText: 'Einblenden',
}
```

Der Nutzer sieht einen Toggle auf der Modul-Seite. Wenn aktiv, bekommt jedes
Item, das per `_meta`-Lookup gefunden wird, ein farbiges Sprechblasen-Badge
über seinem Element auf der Seite.

Klick auf ein Badge → die Sidebar navigiert zum passenden Item und scrollt
es in den Sichtbereich (zentral in `App.vue` behandelt).

---

## Konventionen und Stolperfallen

### Datei-Benennung

- `index.js` (kleingeschrieben) für den Checker
- `Index.vue` (groß) für die Sidebar-Seite
- Der Unterschied in der Schreibweise ist Absicht — Vite unterscheidet sie

### Item-Suche via `_meta`

Setze immer `_meta`, damit Overlays und die HTML-Extraktion des Chatbots das
Element später finden können. Übliche Muster:

```js
// Tag-und-Index-Lookup (am häufigsten)
{ _meta: { tag: 'A', idx: 5 } }

// Direkter CSS-Selektor (für Elemente, die du selbst injiziert hast)
{ _meta: { selector: '#my-injected-span' } }

// Background-Image-Divs (kein <img>-Kind)
{ _meta: { isBackground: true, idx: 2 } }

// Bild-Lookup über Dateiname / alt
{ _meta: { src: '/logo.svg', name: 'logo.svg', alt: 'Logo' } }
```

### Schweregrad-Regeln

- `type: 'error'` — defektes oder kritisches Problem (rot)
- `type: 'warning'` — Verbesserungsmöglichkeit (orange)
- `type: 'success'` — bestanden (grün, nur sichtbar bei Filter "all")

### Keine Imports im Checker

Imports auf Modulebene werden bei der Serialisierung entfernt. Entweder:

- Helper innerhalb der `check()`-Funktion platzieren
- Werte via `args` vom Runner übergeben (`apiConfig`-Export setzen)

```js
import { API } from '@/config/api.js'
export const apiConfig = { url: API.myApi.url }   // ✓ als Argument übergeben

export default async function check(config) {
  const url = config.url   // ✓ verfügbar
}
```

### `runInBackground` statt rohem `sendMessage` verwenden

Das Framework bietet `runInBackground(type, payload)` als Promise-gewrapptes
Shortcut. Bevorzuge es:

```js
// Alt (funktioniert noch)
const reply = await new Promise(resolve =>
  chrome.runtime.sendMessage({ type: 'X', foo }, resolve)
)

// Neu (bevorzugt)
const reply = await runInBackground('X', { foo })
```

### README hinzufügen

Jedes Modul bekommt eine `README.md` neben seiner `module.json`. Dokumentiere
kurz, **was** geprüft wird, **warum** (besonders bei nicht-offensichtlichen
Heuristiken) und **bekannte Einschränkungen**. Dein zukünftiges Ich und die
Mitwirkenden werden es dir danken.
