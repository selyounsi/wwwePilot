# Overview-Modul

Übergeordneter Seiten-Audit, der technisches Setup, grundlegendes SEO und
HTML-Hygiene abdeckt. Das ist das erste Modul im Dashboard (`order: 1`),
weil die meisten hier erfassten Issues für *jede* Seite gelten.

## Was geprüft wird

Die Items sind auf der Seite in drei Kategorien gruppiert:

### Technik
- **robots.txt** — erreichbar, enthält eine `Sitemap:`-Referenz
- **sitemap.xml** — erreichbar, sieht nach XML aus (`<?xml`, `<urlset>` oder `<sitemapindex>`)
- **Favicon** — `favicon.ico` erreichbar; Warning, wenn nicht 192×192 px
- **Counter** — `usecurez.js`-Script vorhanden und Query-Param `k=...` gesetzt
- **Privacy Control** — `window.privacyControl.version` definiert

### SEO
- **Meta Title** — vorhanden, 30-60 Zeichen
- **Meta Description** — vorhanden, 120-160 Zeichen
- **Canonical** — `<link rel="canonical">` vorhanden
- **Open Graph** — `og:title`, `og:description`, `og:image` alle vorhanden

### HTML
- **`<html lang>`** — Attribut vorhanden
- **Viewport-Meta** — vorhanden
- **theme-color** — vorhanden und nicht der Template-Default (`#000` / `black`)

## Warum kein Overlay

Die Overview-Items lassen sich nicht auf konkrete Seitenelemente abbilden (das
meiste lebt im `<head>`), daher würde ein Overlay keinen Sinn ergeben.
`overlay = null`.

## Einschränkungen

- robots/sitemap-Fetches gehen über `fetch()` aus dem Page-Kontext — das
  bedeutet nur Same-Origin. Subdomains können als unerreichbar gemeldet werden,
  obwohl sie existieren.
- Favicon-Dimensionsprüfung lädt das Icon als `<img>` und liest `naturalWidth`.
  Dynamisch ausgelieferte Favicons (PHP usw.) funktionieren, aber ICO-Container
  mit mehreren Größen melden nur den Default-Frame.
- Das `theme-color`-Regex-Matching ist konservativ — nur `#000`, `#000000`,
  `black` werden als Default markiert. `rgb(0,0,0)` etc. nicht (gilt als
  beabsichtigt).
