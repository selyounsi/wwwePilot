# wwweBar

Inhouse Chrome Extension (Manifest V3, Side Panel) für die wwwe-Mitarbeiter.
Sidebar mit mehreren Services, die die tägliche Arbeit an Webseiten
vereinfachen — Qualitätsprüfung, KI-Hilfe, mehrsprachig (EN/DE).

## Services

| Service | Pfad | Was tut er? |
|---|---|---|
| **Web Checker** | [`src/services/web-checker/`](src/services/web-checker/README.md) | Prüft die offene Seite auf SEO, Bilder, Links, Kontrast, Headings, Performance, strukturierte Daten, Rechtschreibung, HTML-Validität, Barrierefreiheit. Single-Page und sitemap-basierter Site-Wide-Check. |
| **KI-Assistent** | [`src/services/chatbot/`](src/services/chatbot/README.md) | Chat-Interface mit zwei Providern: wwwe-Backend und Claude (eigener API-Key). Im Web-Checker via "Im Chat analysieren"-Button auf jedem Item ansprechbar. |

Sobald du einen weiteren Service unter `src/services/<id>/` anlegst, taucht er
automatisch im Dashboard und im Burger-Menü auf — siehe
[docs/creating-a-service.md](docs/creating-a-service.md).

## Tech Stack

- Chrome Manifest V3 (Side Panel API)
- Vue 3, Vue Router 4, Vite 7, CRXJS
- Tailwind CSS v4 (mit `@theme`/`@utility`)

## Setup

```bash
git clone <repo-url>
cd wwweBar/extension
npm install
cp .env.example .env       # ggf. Backend-URLs anpassen
npm run dev                # Dev-Build mit Hot Reload, Output nach dist/
```

In Chrome:
1. `chrome://extensions/` → **Entwicklermodus** an
2. **"Entpackte Erweiterung laden"** → `dist/` Ordner wählen

Icon erscheint in der Toolbar; Klick öffnet die Sidebar.

### `.env`

```env
VITE_ENV=local                       # local → localhost:3000 | production → VITE_BACKEND_URL
VITE_BACKEND_LOCAL=http://localhost:3000
VITE_BACKEND_URL=https://example.com
```

### Backend (optional)

Spellcheck, PageSpeed und der wwwe-Chatbot brauchen ein eigenes Backend
(separates Projekt). Ohne Backend funktionieren alle DOM-basierten Module
trotzdem (Headings, Images, Links, Contrast, Validation, Accessibility, ...).

## Projektstruktur (high-level)

```
extension/
├── src/
│   ├── main.js, App.vue, background.js   ← App-Bootstrap, Service Worker
│   ├── views/                            ← Globale Views (Dashboard, Settings)
│   ├── router/                           ← Auto-Discovery Routing
│   ├── composables/
│   │   ├── i18n/, settings/              ← Globale Composables
│   │   ├── loaders/                      ← Service- und Modul-Loader (auto via glob)
│   │   └── overlay/                      ← Overlay-System für Seiten-Badges
│   ├── components/ui/                    ← Globale UI-Komponenten (auto-registriert)
│   ├── translations/translations.json    ← Globale Übersetzungen
│   ├── config/                           ← Statische Konfiguration (API-URLs, Default-Ignore-Selektoren)
│   ├── assets/css/style.css              ← Tailwind-Theme + globale Styles + Scrollbar
│   └── services/
│       ├── web-checker/                  ← Web Checker Service (siehe README dort)
│       └── chatbot/                      ← Chatbot Service (siehe README dort)
├── docs/                                 ← Doku (siehe unten)
└── manifest.json
```

## Doku

| Datei | Inhalt |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Aufbau, Kontexte, Auto-Discovery, Settings/i18n-System, Datenflüsse |
| [docs/creating-a-service.md](docs/creating-a-service.md) | Neuen Service anlegen (Step-by-Step) |
| [docs/creating-a-module.md](docs/creating-a-module.md) | Neues Modul anlegen (Web-Checker-Modul oder Chatbot-Provider) |
| [docs/module-api.md](docs/module-api.md) | Vollständige Modul-API-Referenz |
| [docs/i18n.md](docs/i18n.md) | Übersetzungssystem, Translation-Files, `t()` und `window.__t` |
| `services/<id>/README.md` | Pro-Service-Doku |
| `services/web-checker/modules/<id>/README.md` | Pro-Modul-Doku (was prüft das Modul, Edge Cases) |
