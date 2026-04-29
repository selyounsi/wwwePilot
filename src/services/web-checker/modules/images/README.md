# Images module

Alt-text quality, lightbox configuration, upscaling detection and
background-image flags.

## What it checks

### `<img>` tags
- **Broken** — `naturalWidth === 0 && complete` (and not lazy-loaded)
- **Blacklisted filename** — patterns like `shutterstock`, `gettyimages`,
  `istock`, `screenshot`, `depositphotos`, `adobe-stock`, `dreamstime`
- **Missing alt** — error
- **Alt too short** — warning when `< 3` characters
- **Auto-generated alt** — error when alt matches the filename or looks
  like a hash / generated string (heuristics: 10+ alphanumeric chars,
  hex blob, contains `resized`/`large`/`small`/`medium`/`_x[12]_`)
- **Lightbox** — when wrapped in `.cms-image a[href=image]`, the
  `.cms-image` container must have `lightbox-zoom-image` class or
  `data-lightbox-type` attribute
- **Upscaled** — warning when rendered size is more than 2px larger than
  natural size (skipped for `.svg` — vector scales losslessly)

### Background images
- **`<div style="background-image: url(...)">`** — flagged because
  background images are bad for SEO (no alt text possible)
- **`data-cms-src` on non-`<img>`** — same reasoning

### Lightbox-only `<a>` links (no inner `<img>`)
- Same lightbox-class check as above

## Element lookup

- `<img>` items: `_meta = { tag: 'IMG', idx, src, name, alt }` — supports
  fingerprint-based lookup via filename if tag+idx fails (CMS images
  with hashed src tend to be stable by filename)
- Background-image divs: `_meta = { isBackground: true, idx }` — looked
  up via `[style*="background-image"], [data-cms-src]:not(img)` order

## Thumbnails

Each item shows a 64×64 thumbnail in the list. Background-image src is
resolved to absolute URL via `new URL(rawSrc, document.baseURI).href` so
`<img>` rendering works (relative `/upload/...` paths would 404 against
the sidebar's `chrome-extension://` origin).

## Limitations

- Lightbox detection is hard-coded to the project's `.cms-image` /
  `.lightbox-zoom-image` convention. Other lightbox libraries (Fancybox,
  GLightbox, etc.) need adjustment.
- The blacklist is a fixed list; not configurable via UI yet.
- "Auto-generated alt" heuristics catch most CMS auto-fills but are not
  exhaustive.
