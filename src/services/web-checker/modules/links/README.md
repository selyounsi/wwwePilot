# Links-Modul

Link-Qualität, Erkennung des zugänglichen Namens und Erreichbarkeitsprüfung.

## Was geprüft wird

Für jedes `<a href>` auf der Seite (nach dem `IGNORE_SELECTORS`-Filter):

- **Defekt (404)** — Service Worker führt einen `HEAD`- und dann einen
  `GET`-Request aus, Fehler wenn Status ≥ 400 (und nicht 999, was
  Twitter/LinkedIn für Bots zurückgeben)
- **Leerer Link** — Fehler, wenn kein sichtbarer Inhalt vorhanden ist (kein
  Text, kein `<img alt>`, kein `aria-label` UND kein CSS-Icon via
  `hasVisualContent` erkannt)
- **Icon-Link ohne Label** — Fehler, wenn der Link visuellen Inhalt hat (z.B.
  CSS-Icon), aber weder `title` noch `aria-label` — Screenreader können ihn
  nicht benennen
- **Fehlender `title`** — Fehler bei normalen Links ohne `title`-Attribut
  (übersprungen für Anker-Links und Icon-Links, die keinen Title brauchen)
- **Title === Linktext** — Warning, wenn `title` exakt mit dem sichtbaren
  Text übereinstimmt — Title sollte zusätzliche Infos liefern, nicht duplizieren
- **Extern ohne `_blank`** — Warning, wenn ein externer Link nicht in einem
  neuen Tab öffnet
- **Mailto / Tel ohne Title** — Warning

## URL-Filterung

Das `IGNORE_SELECTORS`-Array oben in `index.js` listet CSS-Selektoren auf.
Jeder Link wird via `closest()` gematcht — der Selektor gilt also für den Link
selbst ODER einen beliebigen Vorfahren:

```js
const IGNORE_SELECTORS = [
  '[href="#content"]',          // "Skip Nav"-Anker überspringen
  '[href="#back-to-top"]',
  '[href="/sitemap"]',
  '.cms-logo',                  // den Logo-Link ignorieren
  '.WidgetSealContainer',       // alle Links innerhalb dieses Widgets ignorieren
]
```

Ignorierte Links werden nicht abgerufen und tauchen nicht in den Ergebnissen auf.

## URL-Schema-Filterung

Nur HTTP(S)-URLs werden an den Broken-Link-Checker geschickt. `javascript:`,
`mailto:`, `tel:`, `data:`, `blob:` und ähnliche sind nicht abrufbar und würden
"URL scheme not supported"-Fehler auslösen — sie werden übersprungen.

## Service Worker (`background.js`)

Behandelt `CHECK_LINKS` — empfängt ein Array von URLs, macht zuerst parallel
`HEAD` (schnell), fällt auf `GET` für mehrdeutige Status zurück, gibt für jede
URL ein `{ url, broken }` zurück.

## Erkennung sichtbarer Inhalte

Nutzt den geteilten Window-Helper `hasVisualContent(el)`. Ein "Icon-Link" wird
erkannt durch:
- keinen Innentext / kein img alt / kein aria-label, UND
- eines von: `::before`/`::after`-Content, `::before`/`::after`-
  background-image oder eigenes `background-image`

Das erfasst sowohl Icon-Font-Links (`<a class="icon-instagram">` mit
`::before { content: '\f16d' }`) als auch reine Bg-Image-Icon-Links.

## Einschränkungen

- Die IGNORE_SELECTORS-Liste ist statisch in `index.js`. Noch keine UI zur
  Konfiguration.
- 404-Erkennung basiert auf HTTP-Status; Soft-404s (200-Status mit "Seite
  nicht gefunden"-Body) werden nicht erkannt.
- Fetch ist HEAD-dann-GET mit Timeouts (5s / 8s). Langsame Server können zu
  False Positives führen.
