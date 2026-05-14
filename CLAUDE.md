# Claude Code Kontext

Diese Datei wird beim Session-Start automatisch geladen — du musst Claude
nichts mehr manuell erklären.

## Was ist das Repo?

Inhouse-Chrome-Extension (Manifest V3, Side Panel) für die wwwe-Mitarbeiter.
Vue 3 + Vite + Tailwind v4. Zwei Services:
- **web-checker** — DOM-Audits (13 Module: accessibility, console, contrast,
  headings, images, links, overview, performance, privacy, sitemap,
  spellcheck, structured-data, validation) per Single-Page oder Site-Wide
- **chatbot** — KI-Assistent mit Provider-Modulen (wwwe-Backend, Claude API)

**Repo-Namen**: lokal `c:\Users\selyounsi\Desktop\wwweBar\extension`, auf
GitHub `selyounsi/wwwePilot`. Backend-Repo separat: `selyounsi/wwwePilotBackend`.

Volle Doku in [README.md](README.md) und [docs/](docs/). Wenn du anfängst:
[docs/architecture.md](docs/architecture.md) für die Architektur und
[docs/composables.md](docs/composables.md) für jeden einzelnen Composable.

## Single-Check vs Site-Check

Zwei UX-Modi die du verstehen musst:

- **Single-Page-Check** — Mitarbeiter ist auf einer Seite, klickt im
  Side-Panel „Prüfen". Module laufen alle in der aktuellen Tab und füllen
  `useCheckStore`. Standard-Fall.
- **Site-Check** — über sitemap.xml werden alle URLs gesammelt, der User
  wählt Modul-Subset + URL-Subset, dann läuft jede URL sequenziell durch.
  Ergebnisse landen in `useSiteCheckStore`. Im Done-Zustand kann zwischen
  „Nach Seite" und „Nach Modul" gewechselt werden. Beim Klick auf eine
  Seite wird die in neuem Tab geöffnet und der Single-Check-Store mit
  den vorhandenen Resultaten hydriert — damit fühlt's sich an wie ein
  frischer Single-Check.

## Wichtige Konventionen

- **Strings über `t()` (Vue) bzw. `window.__t` (Page-Kontext)** — keine
  hardcoded deutschen Strings. Translations: `translations/translations.json`
  pro Ebene. Details: [docs/i18n.md](docs/i18n.md).
- **Page-Kontext-Code (Web-Checker `index.js`) kein Modul-`import`** — wird
  via `Function.toString()` serialisiert. Helper inline definieren oder via
  `apiConfig`-Export.
- **Modul-Convention**: `modules/<id>/views/Index.vue` (Detail) +
  optional `views/SettingsView.vue`. Auto-Discovery via Glob. Details:
  [docs/creating-a-module.md](docs/creating-a-module.md) und
  [docs/creating-a-service.md](docs/creating-a-service.md).
- **Per-Item-Marker**: jeder Modul-Item muss `_meta: { tag, idx }` oder
  `{ selector }` setzen, sonst kollidieren Marker bei Listen mit gleichen
  Attributen (Galerien mit gleichem `alt` etc.).
- **Settings persistieren** über `useModuleSettings(id, defaults)` (Modul) bzw.
  service-eigene Composables (Service). Mechanik in
  `composables/settings/createSettingsStore.js`.
- **Code-Stil**: keine KI-Floskel-Kommentare, keine erklär-Kommentare zu
  selbsterklärendem Code. Default = null Kommentare. Docblocks an
  exportierten Funktionen sind OK wenn sie WHY erklären.

## Update-System

Die Extension hat ein Auto-Update-System gegen das Backend:

- **Bei JEDER Code-Änderung** muss `manifest.json` version gebumpt werden
  (z.B. `0.0.27` → `0.0.28`). Backend baut auf jeden Push automatisch
  einen neuen Build und der Webhook triggert das.
- **`build-assets/update.bat`** (Windows) und **`build-assets/update.sh`**
  (Mac/Linux) werden via `emit-update-script`-Plugin in `vite.config.js`
  zur Build-Zeit mit der Backend-URL inlined nach `dist/` kopiert. `+x`-Bit
  für `.sh` wird gesetzt.
- **Background-Notification** ([src/background/versionCheck.js]
  (src/background/versionCheck.js)) pollt `chrome.alarms` stündlich gegen
  `/api/version` und feuert Desktop-Notifications bei neuer Version.
- Doku: [docs/extension-versioning.md](docs/extension-versioning.md).

## Build & Test-Workflow

```bash
npm run dev      # Hot-Reload-Build → dist/ (für Live-Entwicklung)
npm run build    # Production-Build → dist/ (für MCP-Tests, siehe unten)
```

Extension lädt man manuell in `chrome://extensions/` → „Entpackte Erweiterung
laden" → `dist/`. Bei Code-Änderungen: dort auf Reload klicken (Dev-Build) oder
neu builden + Reload (Prod-Build).

## chrome-devtools-mcp (wenn verfügbar)

Über die `.mcp.json` im Repo-Root ist [chrome-devtools-mcp]
(https://github.com/ChromeDevTools/chrome-devtools-mcp) konfiguriert. Wenn
der Server beim Session-Start vom Harness gemountet wurde, hast du Tools
wie `install_extension`, `navigate_page`, `evaluate_script`,
`list_console_messages`, `take_screenshot`, `lighthouse_audit`.

Standard-Flow für Live-Prüfung:

1. `npm run build` falls `dist/` fehlt oder Code seit letztem Build geändert
2. `install_extension({ path: "<absolute>/extension/dist" })`
3. `new_page` + `navigate_page` zur Ziel-URL
4. `trigger_extension_action` → Side Panel auf
5. `evaluate_script` — Page-Kontext für DOM, oder Sidebar (`list_pages`
   → Side-Panel-URL `chrome-extension://...`) für Composable-State
6. `list_console_messages` für Errors/Warnings
7. `take_screenshot` falls visueller Beweis sinnvoll

**Falls die Tools nicht da sind** (`ToolSearch` findet kein
`mcp__chrome-devtools__*`): Server wurde beim Session-Init nicht
verbunden. Kannst du nicht zur Laufzeit fixen — nur statisch im Code
arbeiten, dem User sagen er soll testen, oder Session neu starten lassen.

Volle Anleitung + Fallstricke + alternative Setups in
[docs/dev-mcp.md](docs/dev-mcp.md).

## Claude-Integration

Eigenes Provider-Modul (`services/chatbot/modules/claude/`) plus
zahlreiche One-Shot-Generatoren im Web-Checker. Komplette Übersicht:
[docs/claude-actions.md](docs/claude-actions.md). Aktueller Stand:

- **Item-Erklären** auf jedem ModuleItem mit Issue (per-Modul-System-Prompts
  in jedem Modul's `index.js` als `export const claude = { ... }`)
- **Site-Bericht** nach Site-Check
- **Alt-Text** pro Bild (Vision)
- **Meta-Description / Page-Title / OG-Tags** im Overview-Modul
- **H1 generieren / verbessern** im Headings-Modul (HeadingStats)
- **ARIA-Label** auf axe-Items mit name-missing-Rules
- **JSON-LD-Schema** im Structured-Data-Modul
- **DSGVO-Fix + Cookie-Banner + DSE-Snippet** im Privacy-Modul
- **URL-Slug-Tippfehler-Check** im Overview-Modul

Alle gated via `useClaude().isAvailable` — Buttons rendern nur wenn Provider
aktiv UND API-Key validiert.

## User-Memory (was bereits persistiert ist)

```
~/.claude/projects/c--Users-selyounsi-Desktop-wwweBar/memory/
```

Aktuelle Einträge:

- **Test before committing** — nie unprompted committen, immer auf
  Bestätigung warten dass User getestet hat
- **Doc in MD files** — jede Code-Änderung muss mit einem MD-Doc-Update
  oder neuem Doc in `docs/` gepaart sein
- **Comments in English** — Code-Kommentare und JSDocs auf Englisch,
  niemals Deutsch (UI-Strings sind weiter Deutsch via `t()`)
- **Minimal comments** — Default = keine Kommentare; nur kurz wo WHY
  nicht offensichtlich ist (Workaround, versteckte Constraint, etc.)

Lies die Files für Volltext + Begründung. Beim Speichern eigener Memories
das Pattern beachten (Frontmatter, eigene `.md`, Pointer in `MEMORY.md`).

## Wenn du nicht weiter weißt

Erst lesen, dann fragen:

| Thema | Doc |
|---|---|
| Aufbau / Konzept | [docs/architecture.md](docs/architecture.md) |
| Datei tut was? | [docs/composables.md](docs/composables.md) |
| Modul-API (Page-Kontext-Helper) | [docs/module-api.md](docs/module-api.md) |
| Neues Modul bauen | [docs/creating-a-module.md](docs/creating-a-module.md) |
| Neuer Service | [docs/creating-a-service.md](docs/creating-a-service.md) |
| Übersetzungssystem | [docs/i18n.md](docs/i18n.md) |
| Login / OIDC | [docs/auth.md](docs/auth.md) |
| Chatbot-Provider an/aus | [docs/chatbot-providers.md](docs/chatbot-providers.md) |
| Claude-Aktionen (komplette Liste) | [docs/claude-actions.md](docs/claude-actions.md) |
| Live-Editor-Bridge + CMS4-Erkennung | [docs/live-editor.md](docs/live-editor.md) |
| Re-Check-Flow + Tab-Handling | [docs/check-flow.md](docs/check-flow.md) |
| Globale UI-Bausteine | [docs/ui-components.md](docs/ui-components.md) |
| Update-System + Notifications | [docs/extension-versioning.md](docs/extension-versioning.md) |
| chrome-devtools-mcp Setup | [docs/dev-mcp.md](docs/dev-mcp.md) |
| Was prüft Modul X im Detail | `services/web-checker/modules/<x>/README.md` |