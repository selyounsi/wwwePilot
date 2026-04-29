# Accessibility-Modul (axe-core)

WCAG-Audit via [axe-core](https://github.com/dequelabs/axe-core), der
Industriestandard-Bibliothek für Accessibility-Tests, die von Lighthouse und
vielen CI-Tools verwendet wird.

## Was geprüft wird

Führt `axe.run()` gegen die Seite aus und meldet:

- **Violations** — bestätigte WCAG-Verstöße (je nach Impact als Error oder
  Warning eingestuft)
- **Incomplete** — Issues, die axe nicht automatisch entscheiden kann; der
  Nutzer sollte manuell prüfen (als Warning eingestuft, mit `[Manuelle Prüfung]`
  als Präfix)

axe deckt ~90 WCAG-Regeln ab, darunter ARIA-Verwendung, Formular-Labels,
Landmark-Regionen, Sprachattribute, Gültigkeit von role/state/value usw.

## Schweregrad-Mapping

| axe Impact | Unser Type | Deutsches Label |
|---|---|---|
| `critical` | error | Kritisch |
| `serious` | error | Schwerwiegend |
| `moderate` | warning | Mittel |
| `minor` | warning | Gering |
| (incomplete, kein Impact) | warning | Manuelle Prüfung |

## Deaktivierte Regeln (Duplikate vermeiden)

Die folgenden Regeln sind deaktiviert, weil wir spezialisierte Module dafür haben:

- `color-contrast` — unser `contrast`-Modul nutzt Pixel-Sampling
- `image-alt` — `images`-Modul
- `link-name` — `links`-Modul
- `heading-order`, `empty-heading` — `headings`-Modul
- `html-has-lang`, `meta-viewport`, `document-title` — `overview`-Modul

## Deutsche Lokalisierung

`axe-core/locales/de.json` ist in die Extension gebündelt. Der Service Worker
lädt sie via `chrome.runtime.getURL('axe-locale-de.json')` und übergibt sie vor
jedem Lauf an `axe.configure({ locale })`, sodass Hilfe-Texte und Failure-
Summaries auf Deutsch erscheinen. Regel-IDs und Impact-Enums bleiben Englisch
(es sind Bezeichner, keine UI).

## Wie axe geladen wird

axe.min.js ist **nicht in das Haupt-JS der Extension gebündelt** — es ist eine
500KB große Datei, die wir bei Bedarf in die Seite injizieren:

1. Vite-Plugin (`copy-axe-core` in `vite.config.js`) kopiert
   `node_modules/axe-core/axe.min.js` → `public/axe.min.js` zur Build-Zeit.
   Vite/CRXJS bündelt dann `public/` in das `dist/`-Root.
2. Dasselbe Plugin kopiert `axe-core/locales/de.json` →
   `public/axe-locale-de.json`.
3. Bei `AXE_RUN` injiziert der Service Worker `axe.min.js` via
   `chrome.scripting.executeScript({ files: ['axe.min.js'] })` und führt dann
   ein zweites `executeScript` mit einer Funktion aus, die `axe.run()` aufruft.

Beide automatisch kopierten Dateien sind gitignored.

## Item-Anzeige

Jedes axe-Finding wird zu einem Item:
- **Titel** = CSS-Selektor des fehlgeschlagenen Elements
- **Issue** = Hilfe-Text der Regel (auf Deutsch)
- **Details** = Regel-ID
- Expand → Regel, Impact, Selector, HTML-Snippet, Doku-Link

## Einschränkungen

- axe-core muss vor jeder Prüfung geladen werden — fügt ~100ms gegenüber
  nativen Modulen hinzu.
- Manche Regeln erfordern manuelle Prüfung und tauchen als
  `[Manuelle Prüfung]`-Warnings auf statt als konkrete Fehler.
- axe läuft gegen denselben DOM-Snapshot — dynamische Inhalte, die nach Beginn
  der Prüfung geladen werden, werden erst beim erneuten Lauf bewertet.
- Die Liste der deaktivierten Regeln ist in `background.js` fest verdrahtet —
  eigene Deaktivierungen erfordern Code-Änderungen.
