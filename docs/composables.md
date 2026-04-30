# Composables

Übersicht aller Composables und Stores in der Extension. Jede Datei einmal kurz
erklärt: was sie macht, wer sie nutzt und welcher State sie zusammenhält.

> Konvention: globale Composables liegen unter `src/composables/`, service-eigene
> unter `src/services/<id>/composables/`. Composables sind plain ESM-Module, kein
> Plugin-System — Auto-Discovery passiert nur für Services und Module.

## Globale Composables (`src/composables/`)

### `loaders/useServiceLoader.js`

Liest alle `services/*/service.json` + `services/*/views/HomeView.vue` via
`import.meta.glob` ein und gibt eine sortierte Service-Liste zurück. Inaktive
Services (`active: false`) werden gefiltert. Sortierung nach `order`-Property,
Services ohne `order` landen am Ende.

- Verwendet von: Dashboard, Settings-Page, Burger-Navigation
- Output: `{ services: [{ id, name, view, ...config }] }`

### `loaders/useModuleLoader.js`

Pendant für Module. Mergt `module.json` (statische Keys) mit `index.js`-Exports
(dynamisch — z.B. `overlay`-Konfiguration mit Funktionen, die JSON nicht halten
kann). JSON gewinnt bei Konflikten.

- Verwendet von: ModulePage, useWebChecker, useChat, ServiceSettingsPage
- Input: `serviceId`
- Output: `{ modules: [{ id, name, checker, view, overlay, defaultFilter, ... }] }`

### `i18n/useI18n.js`

Reaktive Übersetzungs-API. Hydriert die aktuelle Sprache (`wp-lang`) aus
`chrome.storage.local` beim Modul-Load, mergt alle Translation-Files via
Auto-Discovery zu einem flachen Lookup pro Sprache. Multi-Tab-Sync via
`chrome.storage.onChanged`.

- Exports: `useI18n()` → `{ t, lang, setLang, getTable, supportedLangs }`,
  `whenI18nHydrated()`
- Verwendet von: jeder Vue-Component (`t()`), `useCheckRunner` (`getTable()` für
  `window.__t` im Page-Kontext)
- Storage-Key: `wp-lang` (plain String, kein versionierter Wrapper)
- Details: [i18n.md](./i18n.md)

### `settings/createSettingsStore.js`

Generischer Persistenz-Helper für reactive Settings-Stores. Übernimmt:
- Hydrate-on-Module-Load (Promise-exposed für `main.js`-await vor `app.mount`)
- Watch + Save in detached `effectScope` (überlebt Component-Unmounts)
- JSON-Clone vor `storage.set` (verhindert Reactive-Proxy-Serialisierung als
  `{0:'a',1:'b'}`-Objects)
- `reviveArrays`-Recovery-Heuristik beim Read (repariert korrupten Storage)
- Multi-Tab-Sync via `chrome.storage.onChanged` (mit Echo-Guard)
- Schema-Versionierung mit Migrations-Hooks (`{ __v, data }`)
- Dev-Warnings statt stiller `catch {}`

API: `createSettingsStore(storageKey, { state, version, migrations, onHydrate, onSerialize })`
→ `{ hydrationPromise }`. Genutzt von `useModuleSettings` und
`useWebCheckerSettings`.

### `settings/useModuleSettings.js`

Modul-Settings-Singleton. Eine flache Map `{ [moduleId]: { ...settings } }` mit
Per-Modul-Slots, alle persistiert in `chrome.storage.local`
(`wp-module-settings`). Forward-Compat: ergänzt fehlende Defaults bei späteren
Aufrufen, ohne existierende Werte zu überschreiben. Type-Mismatch-Check setzt
korrupte Werte (z.B. Object wo Array erwartet wird) auf den Default zurück.

- Verwendet von: jede `views/SettingsView.vue` eines Moduls
- Page-Kontext: Snapshot via `getAllModuleSettings()` → `window.__moduleSettings`
- Storage-Key: `wp-module-settings`

### `overlay/usePageOverlay.js`

Rendert Issue-Badges direkt auf der geprüften Seite. Wird via
`chrome.scripting.executeScript` in den aktiven Tab + (falls abweichend) den
ursprünglich geprüften Tab injiziert. Behandelt:
- Element-Lookup über `data-${prefix}-id` Attribut (vorher von
  `useModuleAttributes` gesetzt)
- Live-Editor-Fallback: durchläuft alle iframes mit Meta-Heuristiken
  (tag+idx, text-Match, src-Pattern, alt-Text, isBackground-Index)
- Speech-Bubble mit Pfeil, Hover-Highlighting (alle anderen Badges
  transparenter), Klick-Forward an die Sidebar via `OVERLAY_BADGE_CLICK`-Message
- Scroll/Resize-Listener auf Window + iframes für Live-Position-Updates

API: `{ active, show, showSingle, hide, toggle }`. Single-Mode scrollt das
Element zusätzlich in den Viewport.

### `overlay/useModuleOverlay.js`

Komfort-Wrapper über `usePageOverlay` für Modul-Pages. Liest Items aus
`useCheckStore`, mappt sie via `overlayConfig.labelFn` auf das Overlay-Format
und cleant beim `onUnmounted` automatisch auf.

- API: `{ hasOverlay, overlayActive, overlayToggle, labelFn, onText, offText }`
- Verwendet von: `useModuleSetup` (jede Modul-Page), Overlay-Toggle-Button im
  AppHeader

### `liveEditor/useLiveEditorDetector.js`

Erkennt, ob der aktive Tab ein wwwe-Live-Editor ist und ob die geöffnete Page
zur ursprünglich geprüften URL gehört. Sucht im DOM nach `leConfig.website.domain`
+ `leConfig.pagePath`, normalisiert Pfade (Trailing-Slash, `/index`-Suffix,
2-Letter-Sprach-Prefix).

- Output: `null` | `'editor-domain-mismatch'` | `'editor-page-mismatch'` |
  `'editor-match'`
- Verwendet von: SiteCheck (entscheidet, ob ein Refresh des Live-Editor-Tabs den
  bestehenden Check-Cache hydrieren darf)

### `highlight/index.js`

Single-Item-Highlight für Klick-zur-Element-Aktionen. Wrappt `usePageOverlay.showSingle`,
übersetzt das Item-Format des CheckStore in Overlay-Format. Wird typischerweise
beim Klick auf ein Item in der Sidebar aufgerufen.

API: `highlightElement(item, label, clickType)`.

---

## Web-Checker Composables (`src/services/web-checker/composables/`)

### `useWebChecker.js`

Orchestriert den Single-Page-Check. Sequenz:
1. `injectHelper(tabId)` — Page-Kontext-Globals reinpacken
2. `Promise.all(applicable.map(runModule))` — Module parallel ausführen
3. `chrome.scripting.executeScript({ func: mod.checker })` pro Modul
4. Ergebnis in `useCheckStore.setResult()` → reaktive UI-Updates
5. `useModuleAttributes.apply()` schreibt `data-*`-IDs auf gefundene Elemente

Plus `silentRefresh()`: refresht `_meta`-Lookups gegen einen neu geladenen Tab,
ohne den UI-Status zu kippen (für Klick-zur-Detail-aus-Cache).

### `useSiteCheck.js`

Site-Wide-Check-Orchestrator. Lädt `sitemap.xml` via Service-Worker, hält einen
gepinnten Hintergrund-Tab offen, iteriert URLs durch:
- `chrome.tabs.update` → Tab-load-complete → 800ms Settle
- `injectHelper` + alle ausgewählten Module parallel
- Ergebnisse in `useSiteCheckStore`

Plus Pause/Resume-Gate (Promise-basiert) und `chrome.tabs.onRemoved`-Listener
für saubere Cleanup, falls der User den Check-Tab manuell schließt.

### `useCheckStore.js`

Single-Page-Result-Store (reactive Singleton). Enthält:
- `state.results[moduleId]` — letztes Result pro Modul
- `state.checkedTabId`, `state.checkedUrl`, `state.checkedTitle` — Audit-Kontext
- `state.runningModules` — Set der gerade laufenden Module

API: `setRunning`, `setResult`, `setCheckedTab`, `markCheckedAt`, `reset`.

### `useSiteCheckStore.js`

Site-Check-Pendant. Hält eine zweite Dimension `state.results[url][moduleId]`,
plus URL-Selection (welche URLs der User auswählt), Module-Selection,
Progress-Counter und `syncFromSingleCheck()`-Helper, der Single-Page-Ergebnisse
in den Site-Cache zurückspielt, wenn die geprüfte URL Teil eines laufenden Site-Checks
ist.

### `useTabWatcher.js`

Auto-Recheck bei Tab-Reload für Module mit `checkOnReload: true` (z.B. Spellcheck,
Validation). Listened auf `chrome.tabs.onUpdated` (`status === 'complete'`) +
`onRemoved` (resettet den CheckStore, wenn der geprüfte Tab geschlossen wird).
Berücksichtigt Live-Editor-Reloads — nutzt die ursprünglich geprüfte URL als
Audit-Kontext, nicht die neu geladene URL.

API: `{ start, stop }`. Wird von der HomeView gestartet/gestoppt.

### `useUrlFilter.js`

Helper-Funktion `moduleAppliesTo(mod, url, context)` — prüft, ob ein Modul auf
einer URL laufen soll. Liest `module.json.singlePage` / `fullSite` mit
`runOnPaths` / `skipOnPaths`. `skipOnPaths` gewinnt bei Konflikten. Trailing-Slash
wird normalisiert. Leere Listen = überall ausführen.

### `useCheckRunner.js`

`injectHelper(tabId)` — packt vor jedem Run die Window-Globals in den
Page-Kontext: `createCheckResult`, `setHighlightElement`, `isElementVisible`,
`hasVisualContent`, `runInBackground`, `__t`, `__ignoreSelectors`,
`__moduleSettings`. Volle API-Tabelle in [module-api.md](./module-api.md).

### `useModuleSetup.js`

Setup-Bundle für jede Modul-Page (`<ModulePage moduleId>`). Bündelt:
- Result aus `useCheckStore`
- `useModuleFilter` für Filter-Tabs (errors / warnings / all)
- `useModuleOverlay` für Overlay-Toggle
- `useVisibilityWatcher` für Live-Visibility-Updates
- `useModuleAttributes` apply-Trigger

Dadurch braucht eine Modul-Page nur `<ModulePage moduleId="…">` — der Rest ist
zentralisiert.

### `useModuleAttributes.js`

Schreibt nach jedem Run `data-${prefix}-id="<uuid>"` auf die gefundenen
Elemente. Lookup-Strategien (in Reihenfolge):
1. `_meta.selector` — direkter CSS-Selektor
2. `_meta.tag + _meta.idx` — n-tes Element dieses Tags
3. `_meta.text + _meta.tag` — Text-basiert (Contrast)
4. `_meta.isBackground + _meta.idx` — `<div>`-mit-bg-image
5. `_meta.src` / `_meta.name` / `_meta.alt` — Bild-Heuristik

Daten-Attribute sind die Bridge zwischen dem Sidebar-State (UUIDs in Items) und
dem DOM (für Overlay, Highlight, Live-Editor).

### `useModuleFilter.js`

Filter + Sort für eine Modul-Item-Liste. Filter-Modi: `'all'`, `'issues'`
(error+warning), `'errors'`, `'warnings'`. Sortierung: errors → warnings →
success (stable). Wenn keine Issues vorhanden: kein Filter, alle Items werden
gezeigt.

API: `useModuleFilter(resultRef, defaultFilter)` → `{ filter, hasIssues,
filteredResult }`.

### `useVisibilityWatcher.js`

Updated `item.visible` für jedes Item live, basierend auf computed-Style des
echten DOM-Elements. Mechanik:
1. `injectDirtyListener(tabId)` setzt einen scroll/resize-Listener im Page-Kontext,
   der nur ein `window.__wpVisibilityDirty = true` setzt — billig
2. 400ms-Polling von der Sidebar prüft das Flag, recheckt nur bei dirty
3. Bei Tab-Switch (`onActivated`) frisch injizieren + recheck

So bleibt die Sichtbarkeit (für gestrichene/durchsichtige Items) live, ohne
permanenten DOM-Traffic. Beachtet auch Live-Editor-iframes.

### `useWebCheckerSettings.js`

Web-Checker-spezifischer Settings-Store: `customSelectors`, `disabledBuiltins`
(Subset der Built-in-Ignore-Selektoren), `defaultFilter`-Override. Persistiert
unter `wp-web-checker-settings` via `createSettingsStore`. Computed
`effectiveIgnoreSelectors` mergt aktive Built-ins + Custom für den Page-Kontext.

API: `useWebCheckerSettings()` → `{ state, builtins, effectiveIgnoreSelectors,
addCustomSelector, removeCustomSelector, isBuiltinEnabled, toggleBuiltin,
setDefaultFilter }`. Plus `whenWebCheckerSettingsHydrated()` für `main.js`-await.

---

## Chatbot Composables (`src/services/chatbot/composables/`)

### `useChat.js`

Chat-Store + Provider-Dispatch. Hält pro Provider:
- Liste von Chats (Verlauf-Sammlung) in `localStorage`
- Aktiver Chat-Index
- Loading-State

`send(text)` ruft die `default`-Funktion des aktiven Provider-Moduls auf
(`activeModule.checker({ text, history, chatId })`) und pushed Reply in den
Verlauf. Toggle iteriert via `modules.value` über alle aktiven Provider — UI
ist provider-agnostisch.

Provider-Vertrag: [chatbot/README.md](../src/services/chatbot/README.md).
Storage: `localStorage` (`${APP_NAME_LOWER}-chats-v2`), nicht `chrome.storage`.

---

## Zusammengefasst: wer pflegt welchen State?

| Store / State | Composable | Persistenz |
|---|---|---|
| Sprache | `useI18n` | `chrome.storage.local: wp-lang` |
| Modul-Settings (alle Module) | `useModuleSettings` | `chrome.storage.local: wp-module-settings` |
| Web-Checker-Settings | `useWebCheckerSettings` | `chrome.storage.local: wp-web-checker-settings` |
| Single-Page-Check-Resultate | `useCheckStore` | nur in-Memory (reactive) |
| Site-Check-Cache | `useSiteCheckStore` | nur in-Memory (reactive) |
| Chat-Verläufe | `useChat` | `localStorage: wwwebar-chats-v2` |
| Page-Overlay-Active-Flag | `usePageOverlay` | nur in-Memory (reactive) |

## Siehe auch

- [architecture.md](./architecture.md) — Gesamt-Architektur, Datenflüsse
- [module-api.md](./module-api.md) — Page-Kontext-API für Checker
- [creating-a-service.md](./creating-a-service.md) — neuen Service anlegen
- [creating-a-module.md](./creating-a-module.md) — neues Modul anlegen
- [i18n.md](./i18n.md) — Übersetzungssystem
