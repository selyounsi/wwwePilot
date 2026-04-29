# Structured-data module

Detects and inspects JSON-LD schema markup on the page, mirroring how
Google's Rich Results Test groups findings.

## What it checks

1. Walks all `<script type="application/ld+json">` tags
2. Recursively flattens the JSON tree, including:
   - `@graph` containers
   - top-level arrays
   - nested entities like `review[]` inside a LocalBusiness
3. Filters to **rich-result-relevant `@type`s** (LocalBusiness, Review,
   AggregateRating, Article, Product, Event, FAQPage, etc.) — helper
   types like `PostalAddress`, `GeoCoordinates`, `Rating` are skipped
4. Groups entities by primary `@type` — one item per type with a counter
5. Per entity: validates the `image` URL — reachable + dimension checks
   (e.g. `social_branding.png` should be ≥ 250×250)

## Why grouped, not flat

Google's Rich Results Test shows "LocalBusiness: 2 elements" not two
separate entries. We mirror that. Each group's expand view drills down
into the individual entities (clickable sub-collapsibles).

## Image reachability

Uses `<img>` probes (not `fetch()`) so cross-origin images without CORS
headers don't false-fail. `naturalWidth/Height` is readable either way.

## Why `RICH_RESULT_TYPES` lives inside `check()`

`chrome.scripting.executeScript` only serialises the function body — any
module-scope constant would be `undefined` in the page context. The Set
must be declared inside `check()` to be available there.

## Limitations

- We don't walk Schema.org inheritance — `LocalBusiness` is not also
  reported as `Organization` like Google does. Same physical schema, one
  classification.
- Person entities are intentionally **not** in the whitelist. They'd
  show up as duplicates of every Review's author.
- We don't read pixels of bg-images for image-validation; only the URL
  reachability and natural size.
