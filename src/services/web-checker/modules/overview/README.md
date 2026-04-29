# Overview module

High-level page audit covering technical setup, basic SEO and HTML hygiene.
This is the first module shown on the dashboard (`order: 1`) because most
issues caught here apply to *every* page.

## What it checks

Items are grouped into three categories on the page:

### Technik
- **robots.txt** — reachable, contains a `Sitemap:` reference
- **sitemap.xml** — reachable, looks like XML (`<?xml`, `<urlset>` or `<sitemapindex>`)
- **Favicon** — `favicon.ico` reachable; warning if not 192×192 px
- **Counter** — `usecurez.js` script present and `k=...` query param set
- **Privacy Control** — `window.privacyControl.version` defined

### SEO
- **Meta Title** — present, 30-60 characters
- **Meta Description** — present, 120-160 characters
- **Canonical** — `<link rel="canonical">` present
- **Open Graph** — `og:title`, `og:description`, `og:image` all present

### HTML
- **`<html lang>`** — attribute present
- **Viewport meta** — present
- **theme-color** — present and not the template default (`#000` / `black`)

## Why no overlay

The overview items don't map to specific page elements (most live in
`<head>`), so an overlay would make no sense. `overlay = null`.

## Limitations

- robots/sitemap fetches go through `fetch()` from the page context — that
  means same-origin only. Subdomains may be flagged as unreachable even
  when they exist.
- Favicon dimension check loads the icon as an `<img>` and reads
  `naturalWidth`. Dynamically-served favicons (PHP, etc.) work, but ICO
  containers with multiple sizes only report the default frame.
- `theme-color` regex matching is conservative — only `#000`, `#000000`,
  `black` are flagged as default. `rgb(0,0,0)` etc. are not (assumed
  intentional).
