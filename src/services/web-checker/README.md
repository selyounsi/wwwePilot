# Web Checker

Prüft die im aktiven Tab offene Seite und zeigt SEO-, Qualitäts-, Performance-
und Accessibility-Probleme als Items in der Sidebar. Jedes Item kann auf der
Seite hervorgehoben oder via "Im Chat analysieren" an den KI-Assistenten
übergeben werden.

## Zwei Check-Modi

| Modus | Trigger | Was passiert |
|---|---|---|
| **Single-Page** | "Prüfung starten" auf der Service-Übersicht | Alle Module laufen parallel auf dem aktiven Tab |
| **Site-Wide** | "Komplette Website prüfen" → `/service/web-checker/site-check` | Sitemap-basierter Crawl in einem **gepinnten Hintergrund-Tab**: jede URL wird nacheinander geprüft, mit Progress, Pause/Resume, Click-zur-Detailansicht |

Klick auf eine URL-Zeile im Site-Check öffnet sie in neuem Tab und hydriert die
Modul-Detail-Ansicht aus dem Cache (kein zweiter Check). Ein leiser
Background-Refresh (`silentRefresh`) frischt die `_meta`-Lookups gegen den real
geladenen Tab auf, damit Click-to-Highlight korrekt funktioniert.

## Module

10 Module, alle auto-discovered. Reihenfolge im Dashboard via `module.json`-`order`.

| Modul | Was wird geprüft |
|---|---|
| `overview` | robots.txt, sitemap.xml, Favicon, Meta Title/Description, Canonical, OG-Tags, Lang, Viewport, Theme-Color, Counter-Skript, privacyControl |
| `structured-data` | JSON-LD Schemas (Article, LocalBusiness, ...), Image-Reachability, social_branding-Mindestgröße |
| `headings` | H1-H6 Struktur, leere Headings, Hierarchie-Sprünge, doppelte H1, Pre-H1-Headings |
| `images` | Alt-Texte, automatisch generierte Alts, Stock-Photo-Blacklist, Hochskalierung, Lightbox-Klassen, CSS-Background-Bilder |
| `links` | Erreichbarkeit (404), leere Links, Icon-Links ohne Label, fehlende Title-Attribute, externe Links ohne `target="_blank"` |
| `contrast` | WCAG-AA-Kontrast für Texte und Placeholders (CSS-basiert + Pixel-Sampling für bg-images via `chrome.tabs.captureVisibleTab`) |
| `performance` | PageSpeed Mobile/Desktop (Backend), Ressourcen-Anzahl, Transfer-Größe, Scripts/Stylesheets/Bilder |
| `spellcheck` | Rechtschreibung & Grammatik via LanguageTool-Backend, mit modul-eigener Ignore-Wort-Liste |
| `accessibility` | WCAG-Audit via axe-core (im Service-Worker geladen) |
| `validation` | HTML5-Validität via HTMLHint |

Pro Modul liegt eine `README.md` mit Details, Edge-Cases und bekannten
Limitierungen unter `modules/<id>/README.md`.

## Service-Settings

`/service/web-checker/settings` (Burger → Einstellungen → Web Checker):

- **Standard-Filter** — überschreibt den modul-spezifischen `defaultFilter` aus
  `module.json`. Greift beim Rendern jeder Modul-Page.
- **Ignorierte Selektoren** — globale Liste, die `links` und `validation`
  zusätzlich zu ihren eigenen Filtern anwenden:
  - **Standard** (aus `src/config/ignoreSelectors.js`): per Toggle (de)aktivierbar
  - **Eigene** (User-eingegeben): frei verwaltbar

Persistiert via `useWebCheckerSettings` in `chrome.storage.local`
(`wp-web-checker-settings`).

## Modul-Settings

Jedes Modul kann eine `views/SettingsView.vue` haben. Erscheint dann automatisch
unter "Modul-Einstellungen" auf der Service-Settings-Page (Mechanik:
`<ServiceSettingsPage>` aggregiert via Glob).

**Konkretes Beispiel**: `spellcheck/views/SettingsView.vue` mit Ignore-Wörtern
für Markennamen und Eigennamen. Der Spellcheck-Checker filtert Treffer dieser
Wörter aus den Resultaten — clientseitig, kein Backend-Roundtrip.

Modul-State persistiert via `useModuleSettings(moduleId, defaults)` unter
`wp-module-settings`. Wird vom `useCheckRunner` als `window.__moduleSettings.<id>`
in den Page-Kontext mitgegeben — Checker können direkt drauf zugreifen.

## Page-Kontext-Helper

`useCheckRunner.injectHelper(tabId)` packt vor jedem Check folgende Globals
in den Tab:

| Helper | Zweck |
|---|---|
| `createCheckResult()` | Builder für Result `{ errors, warnings, items, addItem, finish }` |
| `setHighlightElement()` | Frische UUID pro Item |
| `isElementVisible(el)` | Rekursive Sichtbarkeitsprüfung |
| `hasVisualContent(el)` | Erkennt Icon-styled leere Elemente |
| `runInBackground(type, payload)` | Promise-Wrapper für `chrome.runtime.sendMessage` |
| `__t(key, params)` | Übersetzungsfunktion ([i18n.md](../../../docs/i18n.md)) |
| `__ignoreSelectors` | Globale Ignore-Selektoren-Liste |
| `__moduleSettings` | Snapshot aller Modul-Settings |

Voller API-Vertrag siehe [docs/module-api.md](../../../docs/module-api.md).

## Verwandte Files

| Datei | Zweck |
|---|---|
| `composables/useWebChecker.js` | Orchestriert Single-Page-Check, `silentRefresh` |
| `composables/useSiteCheck.js` | Orchestriert Site-Wide-Check (Tab pinning, Pause-Gate, Tab-Close-Detection) |
| `composables/useCheckStore.js` | Reaktiver Single-Page-Result-Store |
| `composables/useSiteCheckStore.js` | Site-Check-Store mit URL-Selection, Progress, Cache |
| `composables/useTabWatcher.js` | Auto-Recheck bei Tab-Reload (für `checkOnReload`-Module) |
| `composables/useUrlFilter.js` | `moduleAppliesTo()` — `singlePage`/`fullSite` Pfad-Filter |
| `composables/useWebCheckerSettings.js` | Filter-Override + Ignore-Selektoren |
| `composables/useCheckRunner.js` | `injectHelper` für Page-Kontext-Globals |
| `composables/useModuleSetup.js` | Setup-Bundle je Modul-Page (Overlay, Filter, Watcher, Attributes) |
| `composables/useModuleAttributes.js` | Schreibt `data-${prefix}-*` auf gefundene Elemente, mit Meta-Lookup-Heuristiken |
| `composables/useModuleFilter.js` | Item-Filter (errors/warnings/all) + Severity-Sort |
| `composables/useVisibilityWatcher.js` | Live-Update von `item.visible` über Dirty-Flag-Polling |
| `views/HomeView.vue` | Service-Root mit Modul-Liste |
| `views/SiteCheckView.vue` | Site-Wide-Check Page |
| `views/SettingsView.vue` | Service-Settings (im `<ServiceSettingsPage>`-Wrapper) |

Vollständige Composables-Erklärung über alle Services hinweg:
[docs/composables.md](../../../docs/composables.md).

Neues Modul anlegen → [docs/creating-a-module.md](../../../docs/creating-a-module.md).
