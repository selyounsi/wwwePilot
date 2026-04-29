# Contrast-Modul

WCAG-AA-Kontrastprüfung für Textelemente, inklusive Pixel-Sampling-Fallback für
Text auf Hintergrundbildern und Icon-Erkennung für Elemente, bei denen der
Text selbst versteckt ist.

## Was geprüft wird

Für jedes textführende Element (`h1-6, p, a, span, li, td, th, label,
button, figcaption, blockquote, small, b, strong`):

1. Berechnet die **effektive Vordergrundfarbe** (`color`, alpha-gemischt mit
   dem aufgelösten Hintergrund)
2. Löst die **effektive Hintergrundfarbe** auf, indem es die Vorfahren
   durchwandert und alpha-gemischte `backgroundColor`-Schichten zusammensetzt,
   inklusive `::before`/`::after`-Overlays mit `inset: 0` (das typische
   "Hintergrundbild abdunkeln"-Muster)
3. Wenn irgendwo im Baum oben ein echtes `background-image` existiert (und
   nicht von einem opaken Vorfahren überdeckt wird): nimmt einen Screenshot
   via Service Worker auf, sampelt Pixel im Bounding-Rect des Elements,
   schließt Pixel nahe der Vordergrundfarbe aus und nutzt das gemittelte
   Ergebnis als echten Hintergrund
4. Berechnet das WCAG-Kontrastverhältnis
5. Vergleicht mit AA-Schwellen — 4.5:1 für normalen Text, 3.0:1 für "großen
   Text" (≥ 18px oder ≥ 14px fett)

## Sonderfälle

### Placeholder
`input[placeholder]` und `textarea[placeholder]` werden mit der `color` des
`::placeholder`-Pseudos gegen den Hintergrund des Inputs geprüft. Items
bekommen einen `(Placeholder)`-Suffix.

### Icon-only-Elemente
Wenn der eigene Text des Elements unsichtbar ist (`font-size: 0`, `color:
transparent`, `text-indent: -9999px`, `display: none`, `visibility:
hidden`, `opacity: 0`), fällt der Checker auf die Farbe des
`::before`/`::after`-Pseudos als Vordergrund zurück und nutzt dessen
Schriftgröße für die AA-Large-Schwelle. Items bekommen einen
`(Icon)`-Suffix.

Wenn es auch kein sichtbares Pseudo gibt, wird das Element **komplett
übersprungen** (es ist absichtlich versteckt, oft für Screenreader — kein
Kontrast zu prüfen).

## Off-Screen-Elemente

Pixel-Sampling erfordert, dass das Element **im Viewport** ist (sonst sieht
`captureVisibleTab` es nicht). Off-Screen-Elemente mit Background-Image
fallen auf `'Unsicher'` zurück — eine Warnung, die dem Nutzer vorschlägt,
das Element in den Sichtbereich zu scrollen und das Modul erneut zu prüfen.

## Service Worker (`background.js`)

Behandelt die Nachricht `CONTRAST_SAMPLE_BG`:

1. Erfasst den sichtbaren Tab als PNG via `chrome.tabs.captureVisibleTab`
2. Dekodiert in einen `OffscreenCanvas`
3. Für jedes angeforderte Rect: sampelt jeden N-ten Pixel (adaptiver Schritt
   für Geschwindigkeit), schließt Pixel mit euklidischer RGB-Distanz < 60 zur
   Textfarbe aus, mittelt den Rest

## Einschränkungen

- Pseudo-Overlay-Erkennung erfasst nur `inset: 0`-Muster. Muster wie
  `width: 100%; height: 100%; top: 0; left: 0` würden ebenfalls funktionieren,
  sind aber schwieriger zuverlässig zu erkennen und werden nicht behandelt.
- Wir sampeln keine Pixel hinter Off-Screen-Elementen.
- Moderne SR-only-Muster mit `clip: rect(0,0,0,0); width: 1px;
  height: 1px` werden nicht als "versteckt" erkannt — diese Textelemente
  durchlaufen weiterhin die normale Kontrastprüfung.
- Der Sampling-Schritt ist adaptiv; bei sehr dichtem Text, wo die meisten Pixel
  vordergrundfarbig sind, kann das Sample null zurückgeben und wir fallen auf
  die CSS-basierte Schätzung zurück.
