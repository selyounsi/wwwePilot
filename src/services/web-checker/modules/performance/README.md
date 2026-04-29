# Performance-Modul

Page-Load-Timings, Ressourcen-Counts und PageSpeed-Insights-Audit.

## Was geprüft wird

### Aus `performance.timing` / Resource Timing API
- TTFB, DOMContentLoaded, Load-Events
- Counts von CSS- / JS- / Font- / Image- / Other-Ressourcen
- Insgesamt übertragene Bytes

### Aus der PageSpeed-Insights-API
Zwei Items: **Mobile** und **Desktop**. Pro Strategie:
- Gesamt-Performance-Score (0-100)
- Core Web Vitals (LCP, INP, CLS, TBT, FCP, TTFB) mit Score-Farbe
- Top-Opportunities ("Bilder optimieren", "JS reduzieren", …) mit
  geschätzter Einsparung

## API-Konfiguration

Die PageSpeed-URL wird via `apiConfig` exportiert, damit der Page-Kontext-
Checker sie ohne Bundler-Import lesen kann:

```js
import { API } from '@/config/api.js'
export const apiConfig = { pagespeedUrl: API.pagespeed.url }
```

Das Framework übergibt dieses Objekt als erstes Argument an `check()`.

## Eigene Anzeige

`PerformanceItem` hat spezielle Expand-Views für die PSI-Items (`psi-mobile`
/ `psi-desktop`), die das Vitals-Grid und die Opportunities-Liste anzeigen.
Andere Items nutzen den Standard-Expand von ModuleItem.

## Einschränkungen

- PSI braucht eine öffentlich erreichbare Seite (Googles Crawler muss sie
  erreichen). Localhost oder passwortgeschützte Seiten erhalten keine PSI-
  Ergebnisse.
- Ein PSI-Aufruf pro Strategie — Mobile und Desktop laufen parallel via
  `Promise.all`.
- Ergebnisse werden nicht gecached — jede Prüfung macht frische API-Aufrufe.
