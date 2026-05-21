# Quick Info

Page-specific sidebar service with **two automatic modes**, picked by
the service itself based on the active tab's URL:

- **Quick Info** — URL matches an admin-defined profile → sidebar
  renders the extracted fields grouped into sections, with per-field
  copy / open / send-to-chat actions.
- **Quick Page Info** — no profile match → sidebar renders the page
  detection result (CMS + version, our-site flag, URL origin / path,
  generator, detection signals, optional network probe). Driven by
  the shared [`usePageDetector`](./page-detector.md).

The user never picks a mode. The header title swaps between
**"Quick Info"** and **"Quick Page Info"** to advertise the active
mode; one refresh button drives whichever flow is current.

Everything in the Quick-Info mode is admin-configured in the backend —
sidebar users cannot edit profiles, sections or rules. Quick-Page-Info
mode is entirely client-side: no backend round-trip, no config.

## When it shows up

The service tile appears on the dashboard when:

- the global feature-flag `service.quick-info` is **on** (default true),
  toggle in admin → Feature flags
- the user can pass at least one profile's visibility gate **OR** there
  are no profiles defined — the Quick-Page-Info fallback works for
  every authenticated user

Each of the two modes has its own feature flag, so admins can disable
either one without removing the tile:

| Flag | Controls |
|---|---|
| `service.quick-info` | Master switch — hides the tile entirely when off |
| `module.quick-info.profile` | The Quick-Info / profile-extractor mode |
| `module.quick-info.detector` | The Quick-Page-Info / detector mode |

Mode resolution inside the service:

- **Profile flag on AND profile matches the URL** → Quick-Info mode renders
- otherwise **Detector flag on** → Quick-Page-Info mode renders
- both off → a notice points the user at the feature-flag admin page

## Concepts

```
profile             ← "IPSI Project Detail" / urlPattern: ^https://ipsi…/\d+$
  └─ section        ← "Customer data"   (enabled toggle)
        └─ rule     ← title=E-Mail · kind=link · selector=.contract-owner [href^="mailto:"]
```

- **Profile** matches a URL (regex), bundles sections, has an
  `enabled` flag plus visibility gating (role / user / group,
  OR-unioned).
- **Section** is a visual grouping (`<BaseCard>` per section). Also
  carries an `enabled` flag — disabled sections still appear in the
  admin UI (dimmed, labelled "Disabled") but are filtered out of the
  user-facing `/api/quick-info/profiles` response, so they never
  reach the sidebar.
- **Rule** is one extractor: a CSS selector + how to read it +
  optional regex post-filter + which UI actions to expose. Each rule
  also has its own `enabled` flag and an optional visibility gate
  (role / user / group, OR-unioned) layered on top of the profile's
  gate. Empty rule-level gate = inherit the profile's visibility;
  populated = the rule is restricted *further* (i.e. user must pass
  both the profile gate AND the rule gate). Useful for hiding
  sensitive fields (rates, contact data) from junior roles while
  keeping the same profile visible to the whole team.

## Rule kinds

| kind | What gets extracted | UI |
|---|---|---|
| `text` | `textContent` of the first match (or all when `multiple: true`). Optional `pattern` regex post-filter. | Plain text |
| `link` | `textContent` + `href`. Empty text falls back to href. | Clickable anchor — `mailto:` / `tel:` follow in the current tab, everything else opens a new tab |

### `pattern` post-filter

If set, the rule's `pattern` is compiled as a regex and applied to the
extracted text. If the regex has a capture group, the first group is
used; otherwise the full match. Invalid regex compiles fall through to
the raw text.

Example: extracting just the email from a `mailto:` link's `href`:
- `kind`: `link`
- `selector`: `.contract-owner [href^="mailto:"]`
- `pattern`: `mailto:(.+)` (yields just the address)

### `multiple`

When true the rule emits the list of all matches (rendered as a bullet
list). Default false (first match only).

## Actions

`actions` is a small whitelist per rule:

- `copy` — clipboard button. Multi-value rules join with newlines.
- `open` — only meaningful for `kind=link` with a non-empty `href`.
- `chat` — placeholder right now (toasts only). Once the chatbot exposes
  a programmatic ingest, the `sendToChat` handler in `HomeView.vue`
  gets wired up.

## Backend wiring

| What | Where |
|---|---|
| Schema | `backend/_apps/backend/src/services/quick-info/schema.js` (3 tables) |
| Migration | `backend/_apps/backend/src/services/quick-info/migrations/0015_quick_info.sql` |
| User API | `GET /api/quick-info/profiles` — returns all visible enabled profiles with sections + rules nested |
| Admin API | `/api/admin/quick-info/*` — CRUD for profiles, sections, rules |
| Permissions | `admin.quick-info.read`, `admin.quick-info.write` |
| Feature flag | `service.quick-info` |

The user endpoint is read-only and filtered by the same three-dimensional
visibility gate as check-types: empty roles + users + groups = visible
to all; otherwise role / user-listing / group match.

## Extension wiring

| What | Where |
|---|---|
| Sidebar router | `extension/src/services/quick-info/views/HomeView.vue` (decides which mode to render) |
| Quick-Info mode | `extension/src/services/quick-info/views/ProfileInfoView.vue` |
| Quick-Page-Info mode | `extension/src/services/quick-info/views/PageInfoView.vue` |
| Profile loader / matcher | `extension/src/services/quick-info/composables/useQuickInfoProfiles.js` (5-min cache) |
| Extraction | `extension/src/services/quick-info/composables/useExtraction.js` (one `chrome.scripting.executeScript` per refresh) |
| Page detector | `extension/src/composables/usePageDetector.js` (shared across services) |
| Page meta extractor | `extension/src/composables/usePageMeta.js` (SEO + tech + structure stats) |
| Crawler-hints extractor | `extension/src/composables/useDiscovery.js` (robots.txt + sitemap.xml + per-URL membership / allow check) |
| URL watch | global `extension/src/composables/useActiveTab.js` |
| Admin list | `extension/src/admin/modules/quick-info/views/Index.vue` |
| Admin detail | `extension/src/admin/modules/quick-info/views/ProfileDetail.vue` |
| Admin API client | `extension/src/admin/modules/quick-info/composables/useAdminQuickInfo.js` |

The sidebar re-runs the active mode automatically on every tab-URL
change (via `useActiveTab`'s `chrome.tabs.onUpdated` listener) and
exposes a single manual refresh button in the header.

## Adding a profile (quick guide)

1. Admin → Quick info → New profile
2. Enter display name + URL regex pattern (test the regex on the actual
   URL beforehand)
3. Save → land in the detail view
4. Add at least one section (e.g. "Customer data")
5. Add rules to the section — for each one:
   - Title (what shows above the value)
   - CSS selector (test it via DevTools on the live page)
   - Kind (text / link)
   - Optional pattern (regex post-filter)
   - Actions (copy / open / chat)
6. Open the matching page in a tab and switch to the Quick-info service
   in the sidebar — values should render

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Quick-Page-Info shows up on a URL that should match a profile | Profile regex doesn't match. Test with `new RegExp(pattern).test(url)` in DevTools. Profile cache is 5 min — click the refresh icon to force-reload. |
| Quick-Page-Info shows `Unbekannt` / `unknown` | None of the script markers fired and version attributes are absent. Open "Detection signals" + run "Netzwerk-Probe starten" to fetch the global paths and confirm. |
| Dashes (`—`) instead of values (Quick-Info mode) | Selector matches nothing. Open DevTools on the page and try `document.querySelector('<selector>')`. |
| Pattern post-filter strips too much | First capture group wins. Wrap what you want in `(...)`. No capture group = full match returned. |
| Service tile missing on the dashboard | Global feature flag `service.quick-info` is off (admin → Feature flags). |
| Quick-Info mode never appears | Either no profile is visible to the user (visibility gating), no profile regex matches the URL, or `service.quick-info` flag is off. Quick-Page-Info still works in those cases. |
