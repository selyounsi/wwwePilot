# Modul-API-Referenz

Vollständiger Vertrag für Modul-Autoren. Für die übergreifende Einführung lies
zuerst [architecture.md](./architecture.md) und das Rezept in
[creating-a-module.md](./creating-a-module.md).

---

## `module.json`

Statische Modul-Konfiguration. Wird beim Start von `useModuleLoader` gelesen.

```jsonc
{
  "id":            "my-check",       // string, erforderlich, eindeutig, kebab-case
  "name":          "Mein Check",     // string, erforderlich, Dashboard-Label
  "description":   "Was prüft das",  // string, Dashboard-Untertitel
  "icon":          "mdiCheck",       // MDI-Icon-Name (camelCase)
  "active":        true,             // boolean, Default true. false zum Ausblenden
  "order":         50,               // number, Sortierreihenfolge im Dashboard
  "checkOnReload": false,            // boolean, erneut ausführen wenn Tab fertig lädt
  "allowChatBot":  true,             // boolean, "Im Chat analysieren" auf Items zeigen
  "defaultFilter": "issues",         // 'issues' | 'errors' | 'warnings' | 'all'

  // Pfad-Filter pro Check-Modus. Beide Keys sind optional —
  // fehlt ein Context oder sind beide Listen leer, läuft das
  // Modul in diesem Modus auf ALLEN URLs.
  "singlePage": {
    "runOnPaths":  ["/", "/impressum"],   // Whitelist (leer = überall)
    "skipOnPaths": ["/checkout"]          // Blacklist, gewinnt über runOnPaths
  },
  "fullSite": {
    "runOnPaths":  [],
    "skipOnPaths": []
  }
}
```

Statische Keys können aus Gründen der Rückwärtskompatibilität auch aus
`index.js` exportiert werden (der Loader merged, wobei `module.json` gewinnt).

### Pfad-Filter (`singlePage` / `fullSite`)

```ts
interface PathFilter {
  runOnPaths?:  string[]   // Whitelist exakter Pfade. Leer/fehlt = keine Einschränkung.
  skipOnPaths?: string[]   // Blacklist exakter Pfade. Gewinnt über runOnPaths.
}
```

- Pfade werden **exakt** gegen `new URL(tabUrl).pathname` gematched. Trailing-Slash
  wird normalisiert (`/foo/` ≡ `/foo`), aber sonst kein Pattern-Matching, kein
  Regex, kein Glob.
- **Default ist "läuft überall":** Fehlt der ganze Context-Block (`singlePage`
  oder `fullSite`), oder sind beide Listen leer, gilt das Modul für alle URLs in
  diesem Modus. Du musst die Keys nur setzen, wenn du tatsächlich filtern willst.
- Übersprungene Module bekommen im Dashboard ein graues "Übersprungen"-Badge
  statt Stats — sie sind nicht "fehlgeschlagen", sie wurden bewusst ausgelassen.

Implementierung: [`composables/useUrlFilter.js`](../src/services/web-checker/composables/useUrlFilter.js).

---

## `index.js`

Der Checker des Moduls. Läuft im **Page-Kontext** der geprüften Webseite.

### Default-Export — der Checker

```ts
type Check = (apiConfig?: any) => Result | Promise<Result>
```

Sync oder async. Erhält den `apiConfig`-Export des Moduls (falls vorhanden) als
erstes Argument.

```js
export default async function check() {
  const { addItem, finish } = createCheckResult()
  // ...
  return finish()
}
```

### Benannte Exports

| Export | Typ | Default | Verwendung |
|---|---|---|---|
| `overlay` | `OverlayConfig \| null` | `null` | Aktiviert die Badge-Ebene (siehe unten) |
| `apiConfig` | `any` | `null` | Objekt, das als erstes Argument an `check()` übergeben wird — nutze dies, um Werte aus deiner Bundler-importierten Config (z.B. URLs aus `@/config/api.js`) durchzureichen |

### `OverlayConfig`

```ts
interface OverlayConfig {
  enabled: boolean              // Hauptschalter
  labelFn: (item) => string     // Text, der im Badge über jedem Element angezeigt wird
  onText:  string               // Button-Label, wenn Overlay aktiv ist
  offText: string               // Button-Label, wenn Overlay versteckt ist
}
```

Beispiel:
```js
export const overlay = {
  enabled: true,
  labelFn: (item) => item.tag,
  onText:  'Tags ausblenden',
  offText: 'Tags einblenden',
}
```

---

## Window-Helper (Page-Kontext)

Vorab injiziert von `useCheckRunner.injectHelper()`, bevor irgendein Checker
läuft. Innerhalb deiner `check()`-Funktion auf `window.*` verfügbar.

### `createCheckResult()`

```ts
function createCheckResult(): {
  errors:   { message: string }[]
  warnings: { message: string }[]
  items:    Item[]
  addItem:  (el: Element, checks: Check[], extra?: object) => void
  finish:   () => Result
}

interface Check {
  when:        boolean              // diesen Check einbeziehen?
  type:        'error' | 'warning' | 'success'
  title:       string               // wird als Issue-Nachricht angezeigt
  description?: string              // optionaler Kontext (aktuell nicht gerendert)
}

interface Item {
  type:    'error' | 'warning' | 'success'   // schlimmster Schweregrad in `issues`
  issues:  { type, message }[]
  visible: boolean                  // Ergebnis von isElementVisible(el)
  element: string                   // UUID für Overlay-/Highlight-Lookup
  ...extra                          // alles, was das Modul in `extra` übergeben hat
}

interface Result {
  errors:       { message: string }[]   // dedupliziert, mit (Nx)-Suffix
  warnings:     { message: string }[]
  errorCount:   number
  warningCount: number
  items:        Item[]
}
```

`addItem(el, checks, extra)`:
- `checks` filtert `when: false` und `type: 'success'` für die Issues-Liste heraus
  und leitet daraus den Gesamt-`type` des Items vom schlimmsten Schweregrad ab
- `extra` wird ins Item gespreaded — enthält typischerweise Display-Props (`text`,
  `name`, `href`), das `_meta` für das Element-Lookup und modulspezifische Felder

### `setHighlightElement()`

```ts
function setHighlightElement(): string   // gibt crypto.randomUUID() zurück
```

Gibt eine frische UUID zurück. `addItem` ruft das für dich auf und speichert das
Ergebnis in `item.element`. Du musst es selten direkt aufrufen.

### `isElementVisible(el)`

```ts
function isElementVisible(el: Element): boolean
```

Rekursive Sichtbarkeitsprüfung, die `display`, `visibility`, `opacity`,
Zero-Scale-`transform` und Vorfahren-Sichtbarkeit abdeckt. Wird intern von
`addItem` genutzt, um `item.visible` zu setzen.

### `hasVisualContent(el)`

```ts
function hasVisualContent(el: Element): boolean
```

Gibt `true` zurück, wenn das Element irgendetwas Sichtbares rendert — Text, Kind-
`<img>/<svg>/<picture>/<video>/<canvas>`, `::before`/`::after`-Content
(Icon-Fonts) oder ein background-image (CSS-Icons).

Nützlich, um wirklich leere Elemente von Icon-gestylten zu unterscheiden.
Wird von `links` benutzt, um Icon-only-`<a>`-Tags zu erkennen, und von `contrast`,
um auf die Pseudo-Farbe zurückzufallen, wenn der Text selbst versteckt ist.

### `runInBackground(type, payload?)`

```ts
function runInBackground(type: string, payload?: object): Promise<any>
```

Promise-gewrappter `chrome.runtime.sendMessage`. Ruft einen Service-Worker-
Handler über seinen `type` auf und löst mit der Response des Handlers auf.

```js
const reply = await runInBackground('CHECK_LINKS', { urls })
```

---

## `_meta` — Element-Lookup

Das Framework muss das Element jedes Items später wiederfinden (für Overlays,
Highlight, "Im Chat analysieren"). Das `_meta`-Feld jedes Items sagt
`useModuleAttributes.findEl`, wie es nachschlagen soll.

Auflösungsreihenfolge (erster Treffer gewinnt):

| Strategie | `_meta`-Form | Wann verwenden |
|---|---|---|
| **CSS-Selektor** | `{ selector: '#x' }` | Du hast das Element selbst injiziert |
| **Tag + Index** | `{ tag: 'H1', idx: 3 }` | Häufigster Fall — n-tes Element dieses Tags |
| **Text-basiert** | `{ text: 'foo', tag: 'P' }` | Match über Textinhalt (verwendet von Contrast) |
| **Background-Image** | `{ isBackground: true, idx: 2 }` | `<div>` mit CSS-background-image |
| **Bild-Fingerprint** | `{ src, name, alt }` | Bild-Lookup über Dateiname / alt |

Setze `_meta` immer — ohne es funktionieren weder Badges noch HTML-Extraktion.

---

## `background.js` (optional)

Service-Worker-Handler. Wird von `src/background.js` aus dem Verzeichnis jedes
Moduls automatisch geladen.

```ts
export const type: string         // Nachrichtentyp, für den registriert wird

export async function handle(
  msg: any,                       // der Nachrichtenkörper
  sendResponse: (reply: any) => void,
  sender: chrome.runtime.MessageSender,   // sender.tab.id ist der aufrufende Tab
): Promise<void>
```

Einzelner Type:
```js
export const type = 'AXE_RUN'
export async function handle(msg, sendResponse, sender) {
  sendResponse({ ... })
}
```

Mehrere Types (ein Handler):
```js
export const types = ['CLAUDE_KEY_SET', 'CLAUDE_KEY_GET']
export async function handle(msg, sendResponse) {
  switch (msg.type) {
    case 'CLAUDE_KEY_SET': /* ... */ break
    case 'CLAUDE_KEY_GET': /* ... */ break
  }
}
```

Der Handler kann jede `chrome.*`-API nutzen, die für Service Worker verfügbar ist —
`chrome.tabs`, `chrome.scripting`, `chrome.tabs.captureVisibleTab`,
`chrome.storage`, `fetch` (kein CORS-Preflight aus dem SW-Kontext) usw.

---

## Sidebar-UI-Komponenten

### `<ModulePage>`

Wrappt die Sidebar-Seite eines Moduls mit dem Standard-Layout. Props:

| Prop | Typ | Default | Verwendung |
|---|---|---|---|
| `moduleId` | String | erforderlich | Schlägt die Modul-Konfiguration nach |
| `label` | String | erforderlich | Section-Titel |
| `itemComponent` | Vue Component | null | Wird für jedes `result.items[i]` gerendert |
| `runningMessage` | String | '' | Optionale Caption unter dem Spinner |
| `emptyMessage` | String | "Noch nicht geprüft …" | Wird im Idle-State angezeigt |
| `showStats` | Boolean | true | ModuleStats über den Items anzeigen |

Der Default-Slot erhält `{ result, raw }` für vollständig eigenes Rendering.

### `<ModuleSection>`

Innerer Teil: Filter-Dropdown, Recheck-Button, Overlay-Toggle, Items-Slot.
Du nutzt das normalerweise nicht direkt — `<ModulePage>` wrappt es.

Slot exponiert `{ result, raw }`:
- `result` — eventuell gefiltert, was der Nutzer sehen will
- `raw` — ungefiltert, für Statistiken / Gesamtzahlen

### `<ModuleItem>`

Einzelne Ergebniszeile. Verwende sie innerhalb einer Item-Komponente:

```vue
<ModuleItem :item="normalized" variant="box">
  <template #expand>
    <DetailRow label="Foo">{{ item.foo }}</DetailRow>
  </template>
</ModuleItem>
```

Varianten: `'box'` (gerundete Karte) oder `'list'` (flache Listenzeile).

Die Komponente leitet die Anzeige-Felder vom Item ab:
- `title` aus `item.title ?? item.text ?? item.name ?? item.href`
- `details` aus `item.details ?? item.tag ?? item.href`
- `image` aus `item.image ?? item.src`
- Status-Farbe aus `item.issues` (schlimmster Type)

### `<DetailRow>`

Zeile mit Label und Wert, verwendet in den Expand-Views der Items.

```vue
<DetailRow label="Selector" mono width="w-24">
  {{ selector }}
</DetailRow>
```

Props:
- `label` (erforderlich) — Label-Text auf der linken Seite
- `width` — Tailwind-Width-Klasse für das Label, Default `w-20`
- `mono` — boolean, wendet `font-mono` auf das Label an

Slot ist der Wert (rechte Seite).

### `<ModuleStats>`

Gesamt / Fehler / Warnungen Badges. Props:

| Prop | Default | Verwendung |
|---|---|---|
| `result` | erforderlich | Item-Array-Container |
| `total` | true | "Gesamt"-Badge anzeigen |
| `errors` | true | "Fehler"-Badge anzeigen |
| `warnings` | true | "Warnungen"-Badge anzeigen |

Default-Slot für zusätzliche StatBox-Zellen.
