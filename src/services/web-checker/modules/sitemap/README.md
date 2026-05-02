# Sitemap-Modul

Vergleicht `sitemap.xml` URLs gegen tatsächlich von dieser Seite verlinkte
URLs. Findet zwei häufige SEO-Bugs:

| Befund | Severity | Bedeutung |
|---|---|---|
| **Linked but not in sitemap** | warning | Page wird von der Site verlinkt, fehlt aber im sitemap.xml — Suchmaschinen haben keinen direkten Hinweis sie zu indexieren |
| **Orphan in sitemap** | error | URL ist im sitemap.xml gelistet, aber von keiner Page der Site verlinkt — User finden den Inhalt nicht über die Navigation, Crawl-Tiefe wird verschwendet |

Erfolgreich-gematcht (linked **AND** in sitemap) wird als success-item
gelistet.

## Pflicht-Annahmen

- `sitemap.xml` liegt auf `${origin}/sitemap.xml` (kein Auto-Discovery via
  `robots.txt`-Sitemap-Eintrag — TODO falls relevant)
- Same-origin Filter: nur interne Links zählen, externe `<a>` werden
  ignoriert
- URL-Normalisierung: trailing-slash und `#fragment` entfernt vor Vergleich

## Architektur

Sitemap-Fetch nutzt den existierenden `FETCH_SITEMAP`-Handler im
[services/web-checker/background.js](../../background.js) (war ursprünglich
für den Site-Wide-Check da). Recursive sitemap-index-resolution inkludiert.

## Caveat

Audit prüft nur die **aktuelle Seite** als "Source der verlinkten URLs".
Wenn die Site einen tiefen Link-Baum hat (z.B. nur über Produktdetail-Pages
verlinkte URLs), erscheinen die als Orphans obwohl sie über Tiefe-2 erreichbar
wären. Pragmatischer Workaround: Site-Wide-Check + manuelle Aggregation
über alle audited pages — dann hat man sample-coverage über N pages.
