# Claude Code Kontext

Diese Datei wird beim Session-Start automatisch geladen — du musst Claude
nichts mehr manuell erklären.

## Was ist das Repo?

Inhouse-Chrome-Extension (Manifest V3, Side Panel) für die wwwe-Mitarbeiter.
Vue 3 + Vite + Tailwind v4. Zwei Services:
- **web-checker** — DOM-Audits (Headings, Images, Links, Contrast, Performance,
  Spellcheck, Validation, Accessibility, …) per Single-Page oder Site-Wide
- **chatbot** — KI-Assistent mit Provider-Modulen (wwwe-Backend, Claude API)

Volle Doku in [README.md](README.md) und [docs/](docs/). Wenn du anfängst:
[docs/architecture.md](docs/architecture.md) für die Architektur und
[docs/composables.md](docs/composables.md) für jeden einzelnen Composable.

## Wichtige Konventionen

- **Strings über `t()` (Vue) bzw. `window.__t` (Page-Kontext)** — keine
  hardcoded deutschen Strings. Translations: `translations/translations.json`
  pro Ebene. Details: [docs/i18n.md](docs/i18n.md).
- **Page-Kontext-Code (Web-Checker `index.js`) kein Modul-`import`** — wird
  via `Function.toString()` serialisiert. Helper inline definieren oder via
  `apiConfig`-Export.
- **Modul-Convention**: `modules/<id>/views/Index.vue` (Detail) +
  optional `views/SettingsView.vue`. Auto-Discovery via Glob.
- **Settings persistieren** über `useModuleSettings(id, defaults)` (Modul) bzw.
  service-eigene Composables (Service). Mechanik in
  `composables/settings/createSettingsStore.js`.
- **Code-Stil**: keine KI-Floskel-Kommentare, keine erklär-Kommentare zu
  selbsterklärendem Code. Docblocks an exportierten Funktionen sind OK.

## Build & Test-Workflow

```bash
npm run dev      # Hot-Reload-Build → dist/ (für Live-Entwicklung)
npm run build    # Production-Build → dist/ (für MCP-Tests, siehe unten)
```

Extension lädt man manuell in `chrome://extensions/` → "Entpackte Erweiterung
laden" → `dist/`. Bei Code-Änderungen: dort auf Reload klicken (Dev-Build) oder
neu builden + Reload (Prod-Build).

## chrome-devtools-mcp ist verfügbar

Über die `.mcp.json` im Repo-Root hat Claude Code Zugriff auf
[chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) —
Tools wie `install_extension`, `navigate_page`, `evaluate_script`,
`list_console_messages`, `take_screenshot`, `lighthouse_audit`,
`list_network_requests`, `performance_start_trace`.

Wenn der User eine Live-Prüfung wünscht (z.B. *"prüfe Seite X"*), nutze diesen
Standard-Flow — vorher kurz prüfen ob `dist/` existiert und aktuell ist:

1. `npm run build` falls `dist/` fehlt oder Code seit letztem Build geändert
2. `install_extension({ path: "<absolute>/extension/dist" })`
3. `new_page` + `navigate_page` zur Ziel-URL
4. `trigger_extension_action` → Side Panel auf
5. `evaluate_script` — entweder im Page-Kontext für DOM-Inspektion oder im
   Sidebar-Kontext (`list_pages` → Side-Panel-URL `chrome-extension://...`),
   um den "Prüfung starten"-Button zu drücken oder Composable-State zu lesen
6. `list_console_messages` für Errors/Warnings
7. `take_screenshot` falls visueller Beweis sinnvoll
8. Ergebnisse als kompakte Zusammenfassung melden

Volle Anleitung + Fallstricke + alternative Setups in
[docs/dev-mcp.md](docs/dev-mcp.md).

## Dinge die schon in Memory sind

Mein User-Memory enthält bereits:
- *"never commit unprompted; wait for the user's confirmation that they've
  tested"* — Commits erst auf explizite Aufforderung.

## Wenn du nicht weiter weißt

Erst lesen, dann fragen:
- Aufbau / Konzept → [docs/architecture.md](docs/architecture.md)
- Datei tut was? → [docs/composables.md](docs/composables.md)
- Modul-API (Page-Kontext-Helper) → [docs/module-api.md](docs/module-api.md)
- Übersetzungssystem → [docs/i18n.md](docs/i18n.md)
- Login / OIDC → [docs/auth.md](docs/auth.md)
- Chatbot-Provider an/aus → [docs/chatbot-providers.md](docs/chatbot-providers.md)
- Claude-Aktionen (Erklären, Alt-Text, Site-Bericht, Meta) → [docs/claude-actions.md](docs/claude-actions.md)
- Live-Editor-Bridge + CMS4-Erkennung → [docs/live-editor.md](docs/live-editor.md)
- Re-Check-Flow + Tab-Handling → [docs/check-flow.md](docs/check-flow.md)
- Globale UI-Bausteine (BaseButton, Tooltip, ConfirmDialog) → [docs/ui-components.md](docs/ui-components.md)
- Was prüft Modul X im Detail → `services/web-checker/modules/<x>/README.md`
