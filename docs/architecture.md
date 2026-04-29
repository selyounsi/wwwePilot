# Architektur

Wie die wwweBar Chrome Extension aufgebaut ist.

## Großes Bild

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Side Panel (Vue 3 SPA)                              │
│  ───────────────────────────                                │
│  Dashboard → Service → Modul → Items                        │
│                                                             │
│  Alles Vue + Vite + Tailwind + CRXJS                        │
└─────────────────────────────────────────────────────────────┘
                          ↓ chrome.runtime.sendMessage
┌─────────────────────────────────────────────────────────────┐
│  Service Worker (background.js)                             │
│  ──────────────────────────────                             │
│  Lädt Handler aus jedem background.js der Module automatisch│
│  und routet Nachrichten anhand des `type` an sie weiter.    │
└─────────────────────────────────────────────────────────────┘
                          ↓ chrome.scripting.executeScript
┌─────────────────────────────────────────────────────────────┐
│  Page-Kontext (die geprüfte Webseite)                       │
│  ──────────────────────────────────                         │
│  Die Checker-Funktion jedes Moduls läuft hier mit Zugriff   │
│  auf das echte DOM via Window-Helpern (createCheckResult,   │
│  setHighlightElement, hasVisualContent, runInBackground).   │
└─────────────────────────────────────────────────────────────┘
```

## Drei Ausführungskontexte

Die Extension führt Code in drei verschiedenen JavaScript-Kontexten aus, die
nur über `chrome.*`-APIs miteinander kommunizieren.

| Kontext | Wo er lebt | Was er kann |
|---|---|---|
| **Sidebar** | `src/App.vue` und darunter | Vue UI, Routing, Store, kann `chrome.scripting.executeScript` und `chrome.runtime.sendMessage` aufrufen |
| **Service Worker** | `src/background.js` + jeweils `*/background.js` | Persistent über Tabs hinweg, zuständig für Netzwerkaufrufe an externe APIs, `chrome.tabs.captureVisibleTab`, `chrome.scripting.executeScript`, `chrome.storage` |
| **Page-Kontext** | injiziert via `chrome.scripting.executeScript` | Läuft in der isolierten Welt der Webseite, hat direkten DOM-Zugriff, teilt sich *keinen* JS-Scope mit der Sidebar |

Die Page-Kontext-Funktionen werden **via `Function.prototype.toString()` serialisiert**
und im Ziel-Tab neu geparst. Das bedeutet:

- Modulebene `import`s und `const`s außerhalb des Funktionskörpers gehen **verloren**
- Alle Konstanten, Helper und Konfigurationen, die der Checker braucht, müssen
  **innerhalb** der Funktion liegen oder via `args` übergeben werden
- Window-Helper (`window.createCheckResult` etc.) werden einmalig vorab via
  `useCheckRunner.injectHelper` injiziert, sodass Checker sie ohne erneute
  Definition nutzen können

## Datenfluss einer einzelnen Prüfung

```
Nutzer klickt "Prüfung starten" im Dashboard
            │
            ▼
useWebChecker.runChecks()           ─── Sidebar
  • setRunning(modId) für jedes
  • injectHelper(tabId)             ─── injiziert window.createCheckResult,
  • Promise.all(modules.map(...))       window.setHighlightElement,
            │                          window.hasVisualContent,
            │                          window.runInBackground
            ▼
chrome.scripting.executeScript({func: mod.checker})  ─── Page-Kontext
            │
            ▼
mod.checker() läuft auf der Seite
  • durchwandert das DOM
  • ruft createCheckResult / addItem auf
  • optional: runInBackground('CHECK_X', payload)  ─── Service Worker
            │
            ▼
gibt zurück { errors, warnings, errorCount, warningCount, items }
            │
            ▼
useCheckStore.setResult(modId, result)              ─── zurück in der Sidebar,
            │                                          reaktiv — UI aktualisiert sich
            ▼
useModuleAttributes.apply()
  • findet das Element jedes Items auf der Seite (via _meta)
  • schreibt data-${prefix}-* Attribute für das Overlay-Lookup
```

## Modulsystem

Jedes Modul ist ein **eigenständiges Verzeichnis** unter
`src/services/web-checker/modules/<id>/`:

```
links/
├── module.json                ← statische Konfiguration (id, name, icon, allowChatBot, ...)
├── index.js                   ← Checker-Funktion im Page-Kontext (Default-Export)
├── Index.vue                  ← Sidebar-Seite (meist ein Einzeiler um <ModulePage>)
├── background.js              ← optional: Service-Worker-Handler für sendMessage
├── components/
│   └── LinkItem.vue           ← Anzeige pro Item
└── README.md                  ← was prüft das Modul, Edge Cases, Warum
```

Module werden via Vites Glob-Imports (`import.meta.glob`) **automatisch entdeckt**.
Lege ein neues Verzeichnis in `modules/` ab und es taucht im Dashboard auf — keine
Registrierung nötig.

## Statische vs. dynamische Konfiguration

Jedes Modul hat zwei Arten von Konfiguration:

| **Statisch** (in `module.json`) | **Dynamisch** (in `index.js`) |
|---|---|
| `id`, `name`, `description`, `icon` | `overlay = { labelFn, onText, offText }` (Funktionen passen nicht in JSON) |
| `active`, `order` | `apiConfig = { ... }` (Werte, die aus Imports kommen) |
| `checkOnReload`, `allowChatBot`, `defaultFilter` | `default function check()` (der Checker selbst) |

Der Loader merged beide, wobei `module.json` gewinnt, wenn beide denselben Key definieren.

## Geteilte Bausteine

Dinge, die **mehrere Module** verwenden, entweder als Vue-Komponenten oder
Window-Helper exponiert (je nachdem, in welchem Kontext sie laufen):

### Vue-Komponenten (Sidebar)
- **`<ModulePage>`** — wrappt AppHeader + ModuleSection + idle/running/done-States.
  Reduziert die typische `Index.vue` eines Moduls von ~25 Zeilen auf 1-3.
- **`<ModuleSection>`** — der innere Teil: Filter-Dropdown, Recheck-Button,
  Overlay-Toggle, Items-Slot.
- **`<ModuleItem>`** — einzelne Ergebniszeile. Kümmert sich um Status-Farbe,
  Expand, Klick-zum-Highlighten, "Im Chat analysieren"-Button.
- **`<DetailRow>`** — Zeile mit Label und Wert, verwendet in den Expand-Views der Items.
- **`<ModuleStats>`** — Gesamt / Fehler / Warnungen Badges.

### Window-Helper (Page-Kontext, injiziert von `injectHelper`)
- **`createCheckResult()`** — gibt `{ errors, warnings, items, addItem,
  finish }` zurück. Der Vertrag des Frameworks für Modul-Ergebnisse.
- **`setHighlightElement()`** — gibt eine frische UUID zurück, die als Element-ID dient.
- **`isElementVisible(el)`** — rekursive Sichtbarkeitsprüfung (display, opacity,
  versteckte Vorfahren, Transforms).
- **`hasVisualContent(el)`** — rendert das Element irgendetwas? (Text, Kind-
  Medien, ::before/::after-Content, background-image)
- **`runInBackground(type, payload)`** — Promise-gewrappter
  `chrome.runtime.sendMessage` für Service-Worker-Aufrufe.

### Composables (Sidebar)
- **`useModuleLoader(serviceId)`** — entdeckt Module eines Services automatisch,
  merged JSON + JS-Exports zu einem einheitlichen Modul-Objekt.
- **`useCheckStore()`** — Vue-reaktiver Store von `state.results[moduleId]`.
- **`useCheckRunner()`** — `injectHelper(tabId)` zum Installieren der Window-Helper.
- **`useModuleSetup(moduleId, ...)`** — verdrahtet Overlay + Sichtbarkeits-Watcher
  + Attribut-Manager für eine einzelne Modul-Seite.
- **`useModuleAttributes(moduleId)`** — schreibt `data-${prefix}-*`-Attribute auf
  Seitenelemente, damit Overlays sie später finden können.
- **`useModuleOverlay(moduleId, overlayConfig)`** — schaltet die Badge-Ebene um.
- **`useModuleFilter(result, defaultFilter)`** — wendet den Filter (Errors/Warnings/All)
  des Nutzers an und sortiert nach Schweregrad.
- **`useTabWatcher(modules)`** — führt `checkOnReload`-Module erneut aus, wenn der
  Tab fertig geladen ist.
- **`useVisibilityWatcher(moduleId)`** — pollt die Sichtbarkeit der Items, falls
  die Seite lazy-loaded oder gescrollt wird.

## Element-Identifikation

Jedes Ergebnis-Item hat ein `element`-Feld, das eine UUID enthält, die von
`setHighlightElement()` generiert wird. Nach Abschluss einer Prüfung:

1. `useModuleAttributes.apply()` schreibt `data-${prefix}-id="<uuid>"` und eine
   Handvoll verwandter Attribute auf das entsprechende Seitenelement.
2. Das Overlay-System sucht Elemente über dieses Attribut.
3. Der "Im Chat analysieren"-Button entfernt dieselben Attribute, bevor er das
   HTML des Elements an den Chatbot sendet.

Das Element wird über das `_meta`-Feld jedes Items **gefunden**, das ein Modul
beim Aufruf von `addItem` setzt. Das Framework unterstützt mehrere Lookup-
Strategien in Prioritätsreihenfolge (siehe `useModuleAttributes.findEl`):

- `meta.selector` — direkter CSS-Selektor (verwendet von Spellcheck für seine
  injizierten Spans)
- `meta.tag` + `meta.idx` — das n-te Element dieses Tags (verwendet von Headings
  und den meisten Modulen)
- `meta.text` + `meta.tag` — text-basierter Fallback (Contrast)
- `meta.isBackground` + `meta.idx` — für `<div>`-mit-bg-image-Items (Images-Modul)
- `meta.src` / `meta.name` / `meta.alt` — bildbasierte Heuristik

## Parallele Ausführung und ID-Sicherheit

Alle Module laufen parallel via `Promise.all`. Um ID-Kollisionen über parallele
Läufe hinweg zu vermeiden, gibt `setHighlightElement` `crypto.randomUUID()` zurück —
es gibt keinen geteilten Counter, sodass parallele `addItem`-Aufrufe in
verschiedenen Modulen sich nicht gegenseitig die IDs überschreiben können.

## Siehe auch

- [creating-a-module.md](./creating-a-module.md) — Schritt-für-Schritt-Anleitung
- [module-api.md](./module-api.md) — vollständige API-Referenz für Modul-Autoren
