# Architektur

Wie die wwweBar Chrome Extension aufgebaut ist.

## Drei JS-Kontexte

Die Extension läuft in drei unabhängigen JS-Welten, die nur per `chrome.*`-API
miteinander kommunizieren:

| Kontext | Wo er lebt | Was er kann |
|---|---|---|
| **Sidebar** | `src/main.js` und der Vue-Tree | UI, Routing, Stores, kann `chrome.scripting.executeScript` und `chrome.runtime.sendMessage` |
| **Service Worker** | `src/background.js` + jeder `*/background.js` | Persistent über Tabs hinweg, externe API-Calls, `chrome.tabs`, `chrome.storage`, `chrome.scripting`, `chrome.tabs.captureVisibleTab` |
| **Page-Kontext** | per `chrome.scripting.executeScript` injiziert | DOM-Zugriff der geprüften Seite, isolierter Scope, kein Vue, keine Modul-Imports |

Page-Kontext-Funktionen werden via `Function.prototype.toString()` serialisiert
und im Ziel-Tab neu geparst. Konsequenz:

- Modulebene-`import`s und -`const`s außerhalb des Funktionskörpers gehen
  **verloren**
- Konstanten/Helper innerhalb der Funktion deklarieren oder via `args`
  übergeben
- Window-Helper (`window.createCheckResult`, `window.__t`, `window.cms`,
  `window.consent`, ...) werden vorab einmal pro Run via
  `useCheckRunner.injectHelper` injiziert
- Page-Main-World-Globals (`window.accessibility`, `window.privacyControl`,
  `window.jQuery`, …) werden zusätzlich vor jedem Audit von Main → Isolated
  kopiert, damit Modul-Code sie direkt via `window.X` lesen kann.
  Vollständige Form in [module-api.md](./module-api.md#page-globals-direkt-auf-window)
- Ein Content-Script ([src/console-capture.js](../src/console-capture.js))
  läuft auf jeder besuchten Seite ab `document_start` im Main World und
  hookt `console.error`/`console.warn`/`window.error`/`unhandledrejection`.
  Captured Messages landen in `window.__capturedConsole` (Page-Main-World),
  werden via Snapshot ins Isolated-World propagiert und vom Console-Modul
  ausgelesen.

## Service-Struktur

```
src/services/<id>/
├── service.json                ← name, description, icon, active, order
├── views/
│   ├── HomeView.vue            ← (Pflicht) Service-Root, Route /service/<id>
│   ├── SettingsView.vue        ← (optional) Service-Settings, /service/<id>/settings
│   └── *View.vue               ← (optional) weitere Sub-Views, /service/<id>/<kebab-name>
├── composables/                ← service-spezifische Composables
├── components/                 ← service-spezifische Komponenten
├── translations/translations.json   ← service-spezifische Übersetzungen
├── background.js               ← (optional) Service-Worker-Handler
└── modules/<mid>/              ← (optional) auto-entdeckte Module
```

## Modul-Struktur

```
modules/<mid>/
├── module.json                 ← (Pflicht) id, name, icon, optional Filter etc.
├── index.js                    ← (Pflicht) Default-Export = Logik
├── views/
│   ├── Index.vue               ← (Pflicht) Modul-Detail-Seite oder Empty-State
│   └── SettingsView.vue        ← (optional) Modul-Settings → Service-Settings-Page
├── components/                 ← Item-Komponenten etc.
├── composables/                ← (optional) modul-eigene Composables
├── translations/translations.json   ← (optional) Modul-Übersetzungen
├── background.js               ← (optional) Service-Worker-Handler
└── README.md                   ← Was prüft das Modul, Edge Cases
```

## Auto-Discovery

Alles via Vite `import.meta.glob` — kein manuelles Registrieren nötig.

| Ressource | Glob |
|---|---|
| Service-Definition | `services/*/service.json` |
| Service-HomeView | `services/*/views/HomeView.vue` |
| Service-Sub-Views | `services/*/views/*View.vue` (außer `HomeView`, Slug = kebab-Filename) |
| Modul-Definition | `services/*/modules/*/module.json` |
| Modul-Logik | `services/*/modules/*/index.js` |
| Modul-Index-View | `services/*/modules/*/views/Index.vue` |
| Modul-Sub-Views | `services/*/modules/*/views/*View.vue` (außer `Index`) |
| Service-SW-Handler | `services/*/background.js` |
| Modul-SW-Handler | `services/*/modules/*/background.js` |
| Translations | `translations/translations.json` (global) + `services/*/translations/...` + `services/*/modules/*/translations/...` |
| Globale UI-Komponenten | `components/ui/**/*.vue` |

→ Welche Composable jeden Glob liest, steht in [composables.md](./composables.md)
(`useServiceLoader`, `useModuleLoader`, `useI18n`, …). Routing wird in
`router/index.js` aufgebaut, UI-Plugin in `components/ui/index.js`.

## Routing

Auto-generierte Pfade:

```
/                                            ← Dashboard (Service-Liste)
/settings                                    ← Globale Settings (Sprache + Service-Settings-Liste)
/service/<sid>                               ← Service-HomeView
/service/<sid>/settings                      ← Service-Settings (isServiceSettings)
/service/<sid>/<slug>                        ← weitere Service-Sub-Views (z.B. /site-check)
/service/<sid>/module/<mid>                  ← Modul-Detail
/service/<sid>/module/<mid>/settings         ← Modul-Settings (isModuleSettings)
/service/<sid>/module/<mid>/<slug>           ← weitere Modul-Sub-Views
```

`route.meta` enthält `serviceName`, `serviceId`, `moduleName`, `moduleId`,
`isServiceSettings`/`isModuleSettings`/`settingsRoot`. Die `BreadCrumb`-Komponente
nutzt das, um die korrekte Hierarchie anzuzeigen — z.B.
`Dashboard › Einstellungen › Web Checker › Spellchecker`.

## Settings-System

Drei Ebenen, jede mit eigener Persistenz in `chrome.storage.local`:

| Ebene | Storage-Key | Beispiel |
|---|---|---|
| Global | `wp-lang` | Sprache (en/de) |
| Service | service-spezifisch (z.B. `wp-web-checker-settings`) | Filter-Override, Ignore-Selektoren |
| Modul | `wp-module-settings` (Map über alle Module) | Spellcheck-Ignore-Wörter |

UI-Aggregation:
- Globale Settings-Page (`/settings`) listet automatisch alle Services mit
  `views/SettingsView.vue`
- `<ServiceSettingsPage>`-Wrapper listet automatisch alle Module mit
  `views/SettingsView.vue` für den aktuellen Service

Persistenz-Mechanik (Hydrate-on-Load, Watch+Save in detached Scope, JSON-Clone,
Multi-Tab-Sync, Schema-Versionierung) ist in
`composables/settings/createSettingsStore.js` zentralisiert und wird von den
konkreten Stores (`useI18n`, `useModuleSettings`, `useWebCheckerSettings`)
verwendet — Details in [composables.md](./composables.md).

Modul-Settings landen vor jedem Web-Checker-Run als
`window.__moduleSettings.<id>` im Page-Kontext — Checker können direkt drauf
zugreifen.

## i18n-System

Drei-Ebenen-Auto-Discovery:

```
src/translations/translations.json                       ← Global (App-Shell)
src/services/<id>/translations/translations.json         ← Pro Service
src/services/<id>/modules/<mid>/translations/...         ← Pro Modul
```

Format:

```json
{
  "de": { "Some Key": "Übersetzung", "Found {count} items": "{count} Treffer" },
  "en": { /* optionale en-Overrides; sonst fällt t() auf den Key zurück */ }
}
```

Lookup-Reihenfolge: `merged[currentLang][key] → merged.en[key] → key`.
Platzhalter `{name}` mit `t('Hello {name}', { name: 'world' })`.

- Sidebar-Code: `const { t } = useI18n()`
- Page-Kontext: `const t = window.__t` (vor jedem Run frisch injiziert)

Sprachwechsel ist live — keine Reload-nötig. Details in [i18n.md](./i18n.md).

## Datenfluss: Single-Page-Check

```
Sidebar (HomeView)
  └→ useWebChecker.runChecks()
       ├→ injectHelper(tabId)                                  ← Page-Kontext: window.createCheckResult, __t, __ignoreSelectors, __moduleSettings
       └→ Promise.all(applicable.map(runModule))
            └→ chrome.scripting.executeScript({ func: mod.checker, args: [apiConfig] })
                 └→ checker liefert { errors, warnings, items }
                      └→ useCheckStore.setResult(modId, result)         ← reaktiv → UI updates
                           └→ useModuleAttributes.apply()              ← Page-Kontext: data-* Attribute via _meta-Lookup
```

## Datenfluss: Site-Wide-Check

```
SiteCheckView
  └→ useSiteCheck.loadPreflight(origin)     ← SW: FETCH_SITEMAP → URL-Liste → Preflight (User wählt Module/URLs)
  └→ useSiteCheck.start()                   ← gepinnter Hintergrund-Tab + onRemoved-Listener
       └→ for-each selected URL:
            ├→ chrome.tabs.update(checkTab, { url })
            ├→ wait for complete + 800ms settle
            ├→ injectHelper
            └→ Promise.all(applicable.map(checker))
                 └→ siteCheckStore.setUrlResult(url, modId, result)
       └→ chrome.tabs.remove(checkTab)
```

Klick auf URL-Zeile nach Abschluss: `chrome.tabs.create(url)` + `silentRefresh`
auf den neuen Tab — `_meta` wird gegen den real geladenen DOM aufgefrischt,
Click-to-Highlight funktioniert.

## Datenfluss: Chatbot-Send

```
HomeView Input → useChat.send(text)
  └→ activeModule.checker({ text, history, chatId })
       ├→ wwwe → fetch wwwe-Backend → { reply } | { error }
       └→ claude → chrome.runtime.sendMessage('CLAUDE_CHAT')
                    └→ modules/claude/background.js → fetch Anthropic API → { reply } | { error }
  └→ useChat.push('assistant', reply)
```

## Element-Identifikation (Web-Checker)

Jedes Result-Item hat:
- `element: <UUID>` — generiert von `setHighlightElement()`
- `_meta` — Lookup-Hint, mit dem `useModuleAttributes.findEl` das Element auf
  der Seite wiederfindet

Nach jedem Run schreibt `apply()` `data-${prefix}-id="<uuid>"` auf das gefundene
Element. Lookup-Strategien (in Reihenfolge):

1. `_meta.selector` — direkter CSS-Selektor (z.B. injizierte Spans)
2. `_meta.tag + _meta.idx` — n-tes Element dieses Tags (häufigster Fall)
3. `_meta.text + _meta.tag` — Text-basiert (Contrast)
4. `_meta.isBackground + _meta.idx` — `<div>`-mit-bg-image (Images)
5. `_meta.src` / `_meta.name` / `_meta.alt` — Bild-Heuristik

Overlay-System und "Im Chat analysieren"-Button finden Elemente per
Data-Attribut.

## Parallele Ausführung und ID-Sicherheit

Alle Module laufen parallel via `Promise.all`. `setHighlightElement` gibt
`crypto.randomUUID()` zurück — kein geteilter Counter, also keine Kollisionen
zwischen parallelen Modul-Runs.

## Siehe auch

- [composables.md](./composables.md) — alle Composables/Stores einzeln erklärt
- [creating-a-service.md](./creating-a-service.md) — neuen Service anlegen
- [creating-a-module.md](./creating-a-module.md) — neues Modul anlegen
- [module-api.md](./module-api.md) — vollständige API-Referenz
- [i18n.md](./i18n.md) — Übersetzungssystem
- [dev-mcp.md](./dev-mcp.md) — Extension mit Claude Code + chrome-devtools-mcp testen
