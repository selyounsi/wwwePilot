# Headings module

Hierarchy and content checks for `<h1>` through `<h6>`.

## What it checks

- **Missing H1** — error if zero `<h1>` on the page
- **Empty heading** — error if a heading has no text content
- **Duplicate H1** — error if more than one `<h1>` (warning may suit some
  sites; here it's an error)
- **Heading-before-H1** — warning if the first heading isn't an `<h1>`
- **Skipped levels** — warning if hierarchy jumps (e.g. H2 → H4)

Every heading also gets a `success` row with the level and text so the
user sees the full hierarchy when filter is "Alle anzeigen".

## Overlay

Toggle "Tags ausblenden / einblenden" — shows each heading's tag name
(H1, H2, …) as a coloured badge above the element on the page. Click a
badge to jump to the matching item in the sidebar.

## Element lookup

`_meta = { tag: 'H1', idx: <document-position> }`. The `idx` is the
position within all elements of that tag, not the headings array — so
overlay lookup via `document.querySelectorAll('H1')[idx]` works.

## Custom display

`Index.vue` shows a `HeadingStats` block (heading count per level) above
the standard ModuleStats. Uses the `<ModulePage>` slot to override the
default items rendering.
