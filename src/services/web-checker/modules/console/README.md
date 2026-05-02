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
| `console.error()` Aufrufe (`source: 'console'`) | Page-Skripte die explizit Fehler loggen |
| `console.warn()` Aufrufe (`source: 'console'`) | Plugins wie GTM4WP, deprecated-warnings vom Code |
| Uncaught `throw new Error(...)` (`source: 'window.error'`) | JS-Crashes |
| Unhandled Promise Rejections (`source: 'unhandledrejection'`) | `Promise.reject()` ohne `.catch()` |
| Network failures (`source: 'network'`) | ALLE failed requests pro Tab — Fonts, CSS, JS, fetch, XHR, navigation. Codes wie `net::ERR_FAILED`, `net::ERR_BLOCKED_BY_CLIENT`, `net::ERR_NAME_NOT_RESOLVED`, `net::ERR_CONNECTION_CLOSED`, etc. Über `chrome.webRequest.onErrorOccurred` im SW. |

`net::ERR_CACHE_MISS` und `net::ERR_ABORTED` werden gefiltert — das sind interne
Browser-Retry-/Cancellation-Codes ohne semantischen Wert für den User. Plus:
Errors werden pro `(url, method)` dedupliziert — nur der letzte Status pro
Resource bleibt.

Resource-Detection-Heuristik: `entry.transferSize === 0`, `decodedBodySize === 0`,
`duration > 0`, **und** `initiatorType === 'css' \| 'link'`. Der Filter auf
CSS/link-initiated requests ist entscheidend — Cross-origin **scripts**
(GTM, recaptcha, etc.) und `<img>`-tracking-pixels haben das gleiche
"opaque response"-Pattern wie echte Failures, sind aber legitim. Sie liefen
durch CSS-Parser hingegen nie und können sicher als Fehler gemeldet werden
wenn sie failsam aussehen.

## Architektur Network-Errors

Ein top-level Listener in `console/background.js` registriert sich beim
SW-Start auf `chrome.webRequest.onErrorOccurred`. Pro Tab werden bis zu
500 Errors in `chrome.storage.session` unter Key `console-net-<tabId>`
gespeichert. Bei `tabs.onUpdated` (status: 'loading') wird der Storage-
Slot geleert (= neue Page-Navigation startet frisch). `tabs.onRemoved`
räumt auf.

Beim Audit ruft das Modul `runInBackground('GET_NETWORK_ERRORS')` auf —
der Handler liefert die Liste für den Sender-Tab zurück.

Das Storage-basierte Setup überlebt SW-Idle (im Gegensatz zu in-memory
Maps). Schwere Trade-offs:
- `webRequest`-Permission triggert beim Update einmal "Update accept"
- Page-Navigation reset ist auf `status: 'loading'` heuristisch — bei
  Single-Page-Apps mit `pushState` werden alte Errors nicht gelöscht

## Was NICHT erfasst wird

- **CSP violations** — optional über `securitypolicyviolation`-Event
  zugänglich, aber selten praktisch nützlich. Nicht implementiert.
- **Browser-native `[issue]` reports** (Deprecated APIs, autocomplete-warnings)
  — DevTools-only, nicht via JS-API erreichbar.

## Items

Pro captured Entry ein Item:

- title: die formatierte Message (Args werden joined, Errors mit Stack)
- description: `Source: console | window.error | unhandledrejection`
- expand-Slot: Stack-Trace falls vorhanden

`window.__capturedConsole === undefined` → Page wurde geladen bevor das
Content-Script aktiv war (Extension neu installiert oder Permissions geändert).
Modul zeigt eine Warnung "reload page".
