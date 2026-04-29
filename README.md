# wwweBar – Chrome Extension

wwweBar ist eine interne Chrome Extension, die allen Mitarbeitern zugänglich gemacht werden soll und die tägliche Arbeit an Webseiten vereinfacht. Sie prüft die aktuell geöffnete Seite auf SEO, Qualität, Barrierefreiheit und Performance – direkt im Browser, ohne dass externe Tools oder Tabs nötig sind.

Fehler, Warnungen und Hinweise erscheinen übersichtlich in einer Seitenleiste. Ergebnisse können direkt auf der Seite als Overlay visualisiert werden, und ein integrierter KI-Assistent hilft beim Analysieren und Beheben von Problemen.

---

## Features

- **Web Checker** – Prüft Headings, Bilder, Links, Kontrast, Rechtschreibung, Performance und strukturierte Daten
- **KI-Assistent** – Chat-Interface für kontextbezogene Hilfe bei gefundenen Problemen
- **Live Editor Support** – Erkennt automatisch iframe-basierte Live-Editoren
- **Overlay-System** – Zeigt Prüfergebnisse direkt auf der Seite als Badges an
- **Einzelprüfung** – Jedes Modul kann unabhängig neu geprüft werden

> **Hinweis:** Einige Features (Rechtschreibprüfung, PageSpeed, KI-Assistent) benötigen ein laufendes Backend. Dieses ist ein separates Projekt und muss lokal zusätzlich gestartet werden.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Extension | Chrome Manifest V3 |
| Frontend | Vue 3, Vue Router, Vite 7, CRXJS |
| Styling | Tailwind CSS v4 |

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) v18 oder neuer
- Google Chrome
- Das wwweBar Backend (separates Projekt) – nur nötig für Spellcheck, PageSpeed und KI-Assistent

---

## Setup

### 1. Repository klonen

```bash
git clone <repo-url>
cd wwweBar
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

`.env` öffnen und anpassen:

```env
VITE_ENV=local                        # local → localhost:3000 | production → VITE_BACKEND_URL
VITE_BACKEND_LOCAL=http://localhost:3000
VITE_BACKEND_URL=https://dein-server.de
```

Wenn das Backend lokal läuft, reicht `VITE_ENV=local` – die Extension spricht dann automatisch `http://localhost:3000` an.

### 4. Extension bauen

```bash
# Entwicklungs-Build mit Hot Reload
npm run dev

# Produktions-Build
npm run build
```

### 5. Extension in Chrome laden

1. Chrome öffnen → `chrome://extensions/`
2. Oben rechts **Entwicklermodus** aktivieren
3. **"Entpackte Erweiterung laden"** klicken
4. Den `dist/` Ordner auswählen

Die Extension erscheint in der Toolbar. Klick auf das Icon öffnet die Seitenleiste.

---

## Projektstruktur

```
wwweBar/
├── src/
│   ├── config/
│   │   └── api.js                    # Backend-URL Konfiguration
│   ├── services/
│   │   ├── web-checker/              # Web Checker Service
│   │   │   ├── service.json          # Service-Konfiguration
│   │   │   ├── views/HomeView.vue    # Modulübersicht
│   │   │   ├── composables/          # Check-Logik, Store, Tab-Watcher
│   │   │   └── modules/              # Einzelne Prüfmodule
│   │   └── chatbot/                  # KI-Assistent Service
│   ├── composables/
│   │   ├── loaders/                  # Service- & Modul-Loader (auto via glob)
│   │   └── overlay/                  # Overlay-System für Seiten-Badges
│   ├── components/ui/                # Globale UI-Komponenten (auto-registriert)
│   ├── views/
│   │   └── DashboardView.vue         # Haupt-Dashboard
│   └── background.js                 # Service Worker + Message Router
├── .env                              # Lokale Umgebungsvariablen (gitignored)
├── .env.example                      # Vorlage für .env
└── manifest.json                     # Chrome Extension Manifest
```

---

## Neuen Service erstellen

1. Ordner anlegen: `src/services/mein-service/`
2. `service.json` erstellen:
```json
{
  "name": "Mein Service",
  "description": "Kurze Beschreibung",
  "icon": "mdiRocket",
  "active": true
}
```
3. `views/HomeView.vue` erstellen
4. Fertig – erscheint automatisch im Dashboard ✅

---

## Neues Modul erstellen

Schnelle Übersicht — siehe **[docs/creating-a-module.md](./docs/creating-a-module.md)** für die ausführliche Anleitung.

1. Ordner anlegen: `src/services/web-checker/modules/mein-modul/`
2. `module.json`:
```json
{
  "id":            "mein-modul",
  "name":          "Mein Modul",
  "description":   "Kurze Beschreibung",
  "icon":          "mdiMagnify",
  "active":        true,
  "order":         5,
  "checkOnReload": true,
  "allowChatBot":  true,
  "defaultFilter": "issues"
}
```
3. `index.js` – Checker-Logik (läuft im DOM der Zielseite):
```js
export const overlay = {
  enabled: true,
  labelFn: (item) => item.title,
  onText:  'Ausblenden',
  offText: 'Einblenden',
}

export default function check() {
  const { addItem, finish } = createCheckResult()

  document.querySelectorAll('h1').forEach((el, idx) => {
    addItem(el, [
      { when: !el.textContent.trim(), type: 'error',   title: 'H1 ist leer' },
      { when: true,                   type: 'success', title: el.textContent.trim() },
    ], { _meta: { tag: 'H1', idx } })
  })

  return finish()
}
```
4. `Index.vue` – Sidebar-Seite (einzeiler über `<ModulePage>`):
```vue
<script setup>
import MyItem from './components/MyItem.vue'
</script>
<template>
  <ModulePage moduleId="mein-modul" label="Mein Modul" :itemComponent="MyItem" />
</template>
```
5. `components/MyItem.vue` – Item-Darstellung
6. Fertig – erscheint automatisch im Web Checker ✅

---

## Dokumentation

- **[docs/architecture.md](./docs/architecture.md)** — Aufbau, Kontexte und Datenfluss
- **[docs/creating-a-module.md](./docs/creating-a-module.md)** — Schritt-für-Schritt-Guide für neue Module
- **[docs/module-api.md](./docs/module-api.md)** — vollständige API-Referenz
- **Per-Modul-READMEs** in `src/services/web-checker/modules/<id>/README.md` — was jedes Modul prüft, Edge Cases, Limitierungen
