# Admin module structure

The admin area lives at `src/admin/` and is split into discrete feature
modules under `src/admin/modules/<name>/`. Each module is a self-contained,
declarative bundle: views, composables, translations, and a single
`module.json` that describes how the module is wired up.

## Layout

```
src/admin/
  AdminLayout.vue                ← shared chrome (sidebar, badge polling)
  routes.js                      ← aggregator (reads every module.json)
  translations.json              ← shared admin chrome strings
  modules/
    <name>/
      module.json                ← declarative config (routes + nav + flags)
      views/
        Index.vue                ← main entry view (mandatory)
        <Sub>.vue                ← additional views (e.g. UserDetail.vue)
      composables/
        useAdmin<X>.js           ← per-module API + reactive state
      translations/
        translations.json        ← module-specific strings
      components/                ← optional, module-local components
```

The `views/Index.vue` filename mirrors the convention used in
`services/web-checker/modules/<id>/views/Index.vue` so service and admin
modules feel the same.

## module.json

Everything about how a module integrates with the admin shell — its routes,
sidebar entry, permissions, on/off state — lives here.

```json
{
  "key":        "reports",
  "enabled":    true,
  "permission": "admin.reports.read",
  "nav": {
    "order": 80,
    "icon":  "mdiBugOutline",
    "label": "Reports",
    "badge": "openReports"
  },
  "routes": [
    { "path": "reports",     "name": "admin-reports",       "view": "Index" },
    { "path": "reports/:id", "name": "admin-report-detail", "view": "ReportDetail" }
  ]
}
```

### Fields

| Field           | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `key`           | Unique slug. Used for nav `:key` and (future) settings keys.           |
| `enabled`       | Set to `false` to hide the module entirely (routes + sidebar).         |
| `permission`    | Default permission for nav visibility + routes that don't override it. |
| `nav.order`     | Sidebar position (ascending). Convention: gaps of 10.                  |
| `nav.icon`      | MDI icon name (e.g. `mdiBugOutline`).                                  |
| `nav.label`     | Translation key for the sidebar label.                                 |
| `nav.badge`     | Optional — name of a resolver in `AdminLayout.vue`.                    |
| `routes[].path` | Path under `/admin/` (e.g. `"users/:id"`).                             |
| `routes[].name` | Vue Router name; used by `router.push({ name })` calls.                |
| `routes[].view` | View basename. Resolves to `views/<view>.vue` in the module folder.    |
| `routes[].permission` | Optional per-route override of the module-level permission.      |

If `nav` is omitted the module has routes but no sidebar entry — useful for
sub-pages that are linked from elsewhere only.

## Adding a new admin module

1. Create `src/admin/modules/<name>/` with:
   - `module.json`
   - `views/Index.vue`
2. Optional:
   - More views in `views/`
   - `composables/useAdmin<Name>.js`
   - `translations/translations.json`
   - `components/<Local>.vue`

The aggregator and i18n loader use `import.meta.glob` — they pick up the new
folder on next build, no central edit needed.

## Sidebar ordering and toggling

- **Re-order**: edit `nav.order` in the relevant `module.json`. Modules render
  in ascending order.
- **Hide temporarily**: set `enabled: false`. The whole module (routes +
  sidebar entry) vanishes from the admin tab. Useful while you're refactoring
  a module or rolling out a half-finished feature.
- **Permission-gate**: change `permission` (module-level) or the per-route
  override.

## Badges

`nav.badge` references a resolver in `AdminLayout.vue`'s `badgeResolvers`
map. The resolver is a function returning a number; values > 0 render a
red pill on the nav row. Adding a new badge = add a resolver in the layout
and the matching `badge: "<key>"` in the module's `module.json`.

## Translations

- Module-specific keys → `modules/<name>/translations/translations.json`
- Shared chrome (Back, Apply, Cancel, User, …) → `admin/translations.json`
- Globs are eager so they ship inlined in the bundle

If a key appears in multiple files the last-merged value wins — keep keys
unique per file.
