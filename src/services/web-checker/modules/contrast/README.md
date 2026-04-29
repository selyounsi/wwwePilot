# Contrast module

WCAG AA contrast checking for text elements, including pixel-sampling
fallback for text on background images and icon detection for elements
where the text itself is hidden.

## What it checks

For each text-bearing element (`h1-6, p, a, span, li, td, th, label,
button, figcaption, blockquote, small, b, strong`):

1. Computes the **effective foreground colour** (`color`, alpha-blended
   with the resolved background)
2. Resolves the **effective background colour** by walking ancestors and
   compositing alpha-blended `backgroundColor` layers, including
   `::before`/`::after` overlays with `inset: 0` (the typical "darken
   bg-image" pattern)
3. If a real `background-image` exists anywhere up the tree (and isn't
   blocked by an opaque ancestor): captures a screenshot via the service
   worker, samples pixels in the element's bounding rect, excludes
   pixels near the foreground colour, and uses the averaged result as
   the real background
4. Computes WCAG contrast ratio
5. Compares against AA thresholds — 4.5:1 for normal text, 3.0:1 for
   "large text" (≥ 18px or ≥ 14px bold)

## Special cases

### Placeholders
`input[placeholder]` and `textarea[placeholder]` are checked using the
`::placeholder` pseudo's `color` against the input's background. Items
get a `(Placeholder)` suffix.

### Icon-only elements
When the element's own text is invisible (`font-size: 0`, `color:
transparent`, `text-indent: -9999px`, `display: none`, `visibility:
hidden`, `opacity: 0`), the checker falls back to the `::before`/`::after`
pseudo's colour as foreground and uses its font size for the AA-large
threshold. Items get an `(Icon)` suffix.

If there's no visible pseudo either, the element is **skipped entirely**
(it's intentionally hidden, often for screen readers — no contrast to
check).

## Off-screen elements

Pixel sampling requires the element to be **in the viewport** (otherwise
`captureVisibleTab` doesn't see it). Off-screen elements with
background-image fall back to `'Unsicher'` — a warning suggesting the
user scroll the element into view and re-check the module.

## Service worker (`background.js`)

Handles the `CONTRAST_SAMPLE_BG` message:

1. Captures the visible tab as a PNG via `chrome.tabs.captureVisibleTab`
2. Decodes into an `OffscreenCanvas`
3. For each requested rect: samples every Nth pixel (adaptive step for
   speed), excludes pixels with Euclidean RGB distance < 60 from the
   text colour, averages the rest

## Limitations

- Pseudo-overlay detection only catches `inset: 0` patterns. Patterns
  like `width: 100%; height: 100%; top: 0; left: 0` would also work but
  are harder to detect reliably and are not handled.
- We don't sample pixels behind off-screen elements.
- Modern SR-only patterns using `clip: rect(0,0,0,0); width: 1px;
  height: 1px` are not detected as "hidden" — those text elements still
  go through normal contrast checking.
- The sampling step is adaptive; for very dense text where most pixels
  are foreground-coloured, the sample may return null and we fall back
  to the CSS-based estimate.
