# Console-Modul

Erfasst JS-Errors und console-Output der Page über die gesamte Lebenszeit
der Page — nicht nur ab Audit-Zeit.

## Architektur

`public/console-capture.js` wird vom `src/background.js` zur Laufzeit via
`chrome.scripting.registerContentScripts({ world: 'MAIN', runAt:
'document_start' })` registriert. Läuft auf allen URLs **vor** jedem Page-
Skript und hookt:

- `console.error(...)` → `{ type: 'error', source: 'console' }`
- `console.warn(...)`  → `{ type: 'warn',  source: 'console' }`
- `window.addEventListener('error', …)`              → `source: 'window.error'`
- `window.addEventListener('unhandledrejection', …)` → `source: 'unhandledrejection'`

Captured Messages landen in `window.__capturedConsole = []` (Page-Main-World
Global), max. 500 Einträge.

Beim Audit kopiert `injectHelper` die Page-Main-World-Globals ins
Isolated-World — so sieht das Modul `window.__capturedConsole` direkt als
`window.__capturedConsole`.

## Was wird erfasst

| Source | Beispiel |
|---|---|
| `console.error()` Aufrufe | Page-Skripte die explizit Fehler loggen |
| `console.warn()` Aufrufe | Plugins wie GTM4WP, deprecated-warnings vom Code |
| Uncaught `throw new Error(...)` | JS-Crashes via `window.error` |
| Unhandled Promise Rejections | `Promise.reject()` ohne `.catch()` |
| Failed CSS-loaded resources (`source: 'resource'`) | CORS-blocked Fonts, sub-CSS-fails — via `PerformanceObserver` |

Resource-Detection-Heuristik: `entry.transferSize === 0`, `decodedBodySize === 0`,
`duration > 0`, **und** `initiatorType === 'css' \| 'link'`. Der Filter auf
CSS/link-initiated requests ist entscheidend — Cross-origin **scripts**
(GTM, recaptcha, etc.) und `<img>`-tracking-pixels haben das gleiche
"opaque response"-Pattern wie echte Failures, sind aber legitim. Sie liefen
durch CSS-Parser hingegen nie und können sicher als Fehler gemeldet werden
wenn sie failsam aussehen.

## Was NICHT erfasst wird

- **Failed `<script>`-tags und `fetch()`/XHR** — opaque cross-origin success
  und failure sind identisch im PerformanceObserver. Würde zu viele
  False-Positives geben (jeder erfolgreiche Tracking-Call würde als Fehler
  gemeldet).
- **CSP violations** — optional über `securitypolicyviolation`-Event
  zugänglich, aber selten praktisch nützlich. Nicht implementiert.
- **Browser-native `[issue]` reports** (Deprecated APIs, autocomplete-warnings)
  — DevTools-only, nicht via JS-API erreichbar.

Wenn man diese **wirklich** braucht: nur via `chrome.debugger.attach` über
Network/Log-Domain — heavy, zeigt User "Browser wird debuggt"-Banner.
Nicht im Modul implementiert.

## Items

Pro captured Entry ein Item:

- title: die formatierte Message (Args werden joined, Errors mit Stack)
- description: `Source: console | window.error | unhandledrejection`
- expand-Slot: Stack-Trace falls vorhanden

`window.__capturedConsole === undefined` → Page wurde geladen bevor das
Content-Script aktiv war (Extension neu installiert oder Permissions geändert).
Modul zeigt eine Warnung "reload page".
