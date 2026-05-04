# Sitemap-Modul

Vergleicht `sitemap.xml` URLs gegen tatsächlich von dieser Seite verlinkte
URLs. Findet zwei häufige SEO-Bugs:

| Befund | Severity | Bedeutung |
|---|---|---|
| **Linked but not in sitemap** | warning | Page wird von der Site verlinkt, fehlt aber im sitemap.xml — Suchmaschinen haben keinen direkten Hinweis sie zu indexieren |
| **Not linked from this page** | warning | URL ist im sitemap.xml gelistet, aber auf der gerade geprüften Page gibt es keinen Link dahin — kann von einer anderen Page erreichbar sein, kann aber auch tatsächlich verwaist sein |

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

## Caveat: Single-Page vs. Site-Wide

Im Single-Page-Modus prüft das Modul nur die **aktuelle Seite** als "Source
der verlinkten URLs". Eine sitemap-URL, die nicht von dieser einen Seite aus
verlinkt ist, könnte trotzdem von einer anderen Seite aus erreichbar sein —
deshalb ist der Befund eine **Warnung, kein Fehler**, und heißt explizit
"Auf dieser Seite nicht verlinkt".

Echte Orphan-Detection (URL nirgendwo verlinkt) erfordert eine site-weite
Aggregation über alle gecrawlten Seiten. Pragmatischer Workaround: den
Site-Wide-Check fahren und die Befunde manuell quertesten.
