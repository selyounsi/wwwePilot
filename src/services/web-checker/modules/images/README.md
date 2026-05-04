# Images-Modul

Alt-Text-Qualität, Lightbox-Konfiguration, Upscaling-Erkennung und
Background-Image-Markierungen.

## Was geprüft wird

### `<img>`-Tags
- **Defekt** — `naturalWidth === 0 && complete` (und nicht lazy-loaded)
- **Geblacklisteter Dateiname** — Muster wie `shutterstock`, `gettyimages`,
  `istock`, `screenshot`, `depositphotos`, `adobe-stock`, `dreamstime`
- **Fehlendes alt** — Fehler
- **Alt zu kurz** — Warning bei `< 3` Zeichen
- **Auto-generiertes alt** — Fehler, wenn alt mit dem Dateinamen übereinstimmt
  oder wie ein Hash / generierter String aussieht (Heuristiken: 10+ alphanumerische
  Zeichen, Hex-Blob, enthält `resized`/`large`/`small`/`medium`/`_x[12]_`)
- **Lightbox** — wenn in `.cms-image a[href=image]` gewrappt, muss der
  `.cms-image`-Container die Klasse `lightbox-zoom-image` oder das Attribut
  `data-lightbox-type` haben
- **Hochskaliert** — Warning, wenn die gerenderte Größe mehr als 2px größer ist
  als die natürliche Größe (übersprungen für `.svg` — Vektor skaliert verlustfrei)

### Hintergrundbilder
- **`<div style="background-image: url(...)">`** — markiert, weil
  Hintergrundbilder schlecht für SEO sind (kein Alt-Text möglich)
- **`data-cms-src` auf nicht-`<img>`** — gleiche Begründung

### Lightbox-only-`<a>`-Links (kein inneres `<img>`)
- Gleiche Lightbox-Klassen-Prüfung wie oben

## Element-Lookup

- `<img>`-Items: `_meta = { tag: 'IMG', idx, src, name, alt }` — unterstützt
  Fingerprint-basiertes Lookup über den Dateinamen, falls tag+idx fehlschlägt
  (CMS-Bilder mit gehashtem src sind oft stabil über den Dateinamen)
- Background-Image-Divs: `_meta = { isBackground: true, idx }` — werden über
  die Reihenfolge `[style*="background-image"], [data-cms-src]:not(img)` aufgelöst

## Thumbnails

Jedes Item zeigt ein 64×64 Thumbnail in der Liste. Background-Image-src wird
via `new URL(rawSrc, document.baseURI).href` zur absoluten URL aufgelöst,
sodass `<img>`-Rendering funktioniert (relative `/upload/...`-Pfade würden
gegen den `chrome-extension://`-Origin der Sidebar 404en).

## Live-Editor-Sprung

Wenn ein zugehöriger CMS4 LE-Tab offen ist, zeigt jedes editierbare Item
einen Stift-Button. Funktioniert für:
- Echte `<img>`-Items, deren `<figure data-element-type="picture">`-Wrapper
  im LE editierbar ist
- Hintergrund-Image-Container (`<div data-element-type="container">` mit
  `style="background-image: url(...)"`) — das Container-Wrapper-Element IST
  selbst der `data-le-eid`-Wrapper, daher gilt es laut Bridge-Regel als
  editierbar (im Gegensatz zu Kindern eines Containers)

Details: [docs/composables.md → useLiveEditorBridge](../../../../../docs/composables.md#liveeditoruseliveeditorbridgejs).

## Einschränkungen

- Lightbox-Erkennung ist auf die `.cms-image` / `.lightbox-zoom-image`-
  Konvention des Projekts fest verdrahtet. Andere Lightbox-Bibliotheken
  (Fancybox, GLightbox usw.) brauchen Anpassungen.
- Die Blacklist ist eine fixe Liste; noch nicht über die UI konfigurierbar.
- "Auto-generiertes alt"-Heuristiken erfassen die meisten CMS-Auto-Fills,
  sind aber nicht erschöpfend.
