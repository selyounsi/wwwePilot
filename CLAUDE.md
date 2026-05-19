# Claude Code Context — Extension

This file auto-loads on session start when working in the `extension/`
repo. Reply to the user in German (per their memory preference) but
keep code and documentation in English.

## What this repo is

In-house Chrome extension (Manifest V3, Side Panel) for wwwe employees.
Vue 3 + Vite + Tailwind v4. Two services:

- **web-checker** — DOM audits (13 modules: accessibility, console,
  contrast, headings, images, links, overview, performance, privacy,
  sitemap, spellcheck, structured-data, validation) — single-page or
  site-wide
- **chatbot** — AI assistant with provider modules (wwwe backend,
  Claude API)

**Repo names**: locally `c:\Users\selyounsi\Desktop\wwweBar\extension`,
on GitHub `selyounsi/wwwePilot`. Backend repo separate:
`selyounsi/wwwePilotBackend`.

Full docs in [README.md](README.md) and [docs/](docs/). Recommended
entry points: [docs/architecture.md](docs/architecture.md) for the
high-level layout and [docs/composables.md](docs/composables.md) for
every individual composable.

## Single-check vs site-check

Two UX modes to understand:

- **Single-page check** — employee is on a page, clicks "Prüfen" in
  the side panel. All modules run in the current tab and fill
  `useCheckStore`. Standard case.
- **Site-check** — sitemap.xml is fetched, all URLs collected; the
  user picks a module subset + URL subset, then each URL runs
  sequentially. Results land in `useSiteCheckStore`. In the done
  state the user can switch between "by page" and "by module". Clicking
  a page opens it in a new tab and hydrates the single-check store
  with the existing results — so it feels like a fresh single-check.

## Important conventions

- **Strings via `t()` (Vue) or `window.__t` (page context)** — no
  hardcoded German strings. Translations live in
  `translations/translations.json` per layer. Details:
  [docs/i18n.md](docs/i18n.md).
- **Page-context code (web-checker `index.js`) cannot use module
  imports** — it's serialised via `Function.toString()`. Define
  helpers inline or via `apiConfig` exports.
- **Module convention**: `modules/<id>/views/Index.vue` (detail) +
  optional `views/SettingsView.vue`. Auto-discovery via glob. Details:
  [docs/creating-a-module.md](docs/creating-a-module.md) and
  [docs/creating-a-service.md](docs/creating-a-service.md).
- **Per-item markers**: every module item must set `_meta: { tag, idx }`
  or `{ selector }`, otherwise markers collide on lists with identical
  attributes (galleries with the same `alt` etc.).
- **Settings persistence** via `useModuleSettings(id, defaults)`
  (module) or service-owned composables (service). Mechanism in
  `composables/settings/createSettingsStore.js`.
- **Code style**: no AI-flavour comments, no explainer comments for
  self-explanatory code. Default = no comments. Docblocks on exported
  functions are fine if they explain WHY.

## Update system

The extension has an auto-update system against the backend:

- **For EVERY code change** bump `manifest.json#version` (e.g.
  `0.0.27` → `0.0.28`). `manifest.json` is the **single source of
  truth** — `package.json#version` is auto-synced on Vite start via
  the `syncPackageVersion` plugin in [vite.config.js](vite.config.js).
  **Do not bump package.json manually.**
- Backend builds a new artefact on every push automatically; the
  webhook triggers it.
- **`build-assets/update.bat`** (Windows) and
  **`build-assets/update.sh`** (Mac/Linux) are copied to `dist/` at
  build time with the backend URL inlined, via the
  `emit-update-script` plugin in `vite.config.js`. The `+x` bit on
  the `.sh` is set automatically.
- **Background notification**
  ([src/background/versionCheck.js](src/background/versionCheck.js))
  uses `chrome.alarms` to poll `/api/version` hourly and fires
  desktop notifications on a new version.
- Docs: [docs/extension-versioning.md](docs/extension-versioning.md).

## Backend locally (Docker)

The backend runs in the `wwwebar-ever-backend-1` Docker container,
not as `npm run dev`. Source is baked into the image (no volume
mount). **Backend code changes require an image rebuild**:

```bash
cd ../backend
docker compose up -d --build ever-backend
docker logs --tail 30 wwwebar-ever-backend-1   # check migrations + mount
```

Without `--build` neither schema migrations nor new routes take
effect and you get 404 on the new endpoint. That's the default
reflex when a new endpoint isn't reachable.

## UI component library

Globally auto-registered components under `src/components/ui/`. When
building tables, modals, form fields, KPI tiles, cards or lists, use
these instead of raw Tailwind:

| What | Component | Doc |
|---|---|---|
| Table | `<DataTable>` + cell helpers | [docs/ui-data-table.md](docs/ui-data-table.md) |
| Modal | `<BaseModal>` | [docs/ui-forms.md](docs/ui-forms.md) |
| Card / Panel | `<BaseCard>`, `<PanelCard>` | [docs/ui-forms.md](docs/ui-forms.md) |
| Form field | `<FormField>`, `<SelectField>`, `<TextareaField>`, `<CheckboxField>` | [docs/ui-forms.md](docs/ui-forms.md) |
| KPI tile | `<KpiTile>` | [docs/ui-forms.md](docs/ui-forms.md) |
| Lists | `<ItemList>` + `<ItemListRow>` | [docs/ui-forms.md](docs/ui-forms.md) |
| Tabs | `<TabNav>` | [docs/ui-forms.md](docs/ui-forms.md) |
| Info tooltip | `<InfoHint>` | [docs/ui-forms.md](docs/ui-forms.md) |

Colour maps (status, severity, scope, category, kind, role) live
**all** inside `CellBadge.vue` — one file, all pills.

## Identity model

Visibility on resources (check-types, later others) is filtered three-
dimensionally:

- **Roles** carry permissions (RBAC)
- **Groups** are pure org collections without permissions (teams,
  departments)
- **Users** can be listed by name

A user sees a resource when **any** of the three conditions matches
(OR, not AND). Full details: [docs/groups.md](docs/groups.md),
[docs/check-types.md](docs/check-types.md).

## Build & test workflow

```bash
npm run dev      # hot-reload build → dist/ (for live development)
npm run build    # production build → dist/ (for MCP tests, see below)
```

Load the extension manually in `chrome://extensions/` → "Load unpacked"
→ `dist/`. On code changes: click reload there (dev build) or rebuild
+ reload (prod build).

## chrome-devtools-mcp (when available)

Wired via `.mcp.json` in the repo root, pointing to
[chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp).
When the server is mounted at session start, tools like
`install_extension`, `navigate_page`, `evaluate_script`,
`list_console_messages`, `take_screenshot`, `lighthouse_audit` are
available.

Standard flow for live checks:

1. `npm run build` if `dist/` is missing or stale
2. `install_extension({ path: "<absolute>/extension/dist" })`
3. `new_page` + `navigate_page` to the target URL
4. `trigger_extension_action` → side panel open
5. `evaluate_script` — page context for DOM, or sidebar
   (`list_pages` → side-panel URL `chrome-extension://...`) for
   composable state
6. `list_console_messages` for errors / warnings
7. `take_screenshot` if visual proof helps

**If the tools aren't there** (`ToolSearch` finds no
`mcp__chrome-devtools__*`): the server wasn't mounted at session
init. Can't fix this at runtime — work statically in code, ask the
user to test, or have them restart the session.

Full guide + pitfalls + alternative setups in
[docs/dev-mcp.md](docs/dev-mcp.md).

## Claude integration

Own provider module (`services/chatbot/modules/claude/`) plus several
one-shot generators in the web-checker. Full overview:
[docs/claude-actions.md](docs/claude-actions.md). Current state:

- **Item-explain** on every ModuleItem with an issue (per-module
  system prompts in each module's `index.js` as
  `export const claude = { ... }`)
- **Site report** after a site-check
- **Alt text** per image (vision)
- **Meta description / page title / og tags** in the overview module
- **H1 generate / improve** in the headings module (HeadingStats)
- **ARIA label** on axe items with name-missing rules
- **JSON-LD schema** in the structured-data module
- **GDPR fix + cookie banner + privacy-policy snippet** in the
  privacy module
- **URL slug typo check** in the overview module

All gated via `useClaude().isAvailable` — buttons only render when
the provider is active AND the API key is validated.

## User memory (already persisted)

```
~/.claude/projects/c--Users-selyounsi-Desktop-wwweBar/memory/
```

Current entries:

- **Chat in German** — reply to the user in German; code/comments
  stay English
- **Test before committing** — never commit unprompted, wait for the
  user to confirm they've tested
- **Doc in MD files** — every code change pairs with an MD doc update
  or a new doc under `docs/`
- **Comments in English** — code comments and JSDocs in English,
  never German (UI strings stay German via `t()`)
- **Minimal comments** — default to no comments; only short ones
  where the WHY isn't obvious (workaround, hidden constraint, etc.)

Read the files for full text + reasoning. When saving your own
memories, follow the pattern (frontmatter, own `.md`, pointer in
`MEMORY.md`).

## When stuck

Read first, then ask:

| Topic | Doc |
|---|---|
| Layout / concept | [docs/architecture.md](docs/architecture.md) |
| What does a file do? | [docs/composables.md](docs/composables.md) |
| Module API (page-context helpers) | [docs/module-api.md](docs/module-api.md) |
| Build a new module | [docs/creating-a-module.md](docs/creating-a-module.md) |
| New service | [docs/creating-a-service.md](docs/creating-a-service.md) |
| Translation system | [docs/i18n.md](docs/i18n.md) |
| Login / OIDC | [docs/auth.md](docs/auth.md) |
| Chatbot providers on/off | [docs/chatbot-providers.md](docs/chatbot-providers.md) |
| Claude actions (full list) | [docs/claude-actions.md](docs/claude-actions.md) |
| Live-editor bridge + CMS4 detection | [docs/live-editor.md](docs/live-editor.md) |
| Re-check flow + tab handling | [docs/check-flow.md](docs/check-flow.md) |
| Check-types (profiles + manual tasks) | [docs/check-types.md](docs/check-types.md) |
| Groups (org collections, no RBAC) | [docs/groups.md](docs/groups.md) |
| Global UI building blocks | [docs/ui-components.md](docs/ui-components.md) |
| Admin tables (`<DataTable>` + cells) | [docs/ui-data-table.md](docs/ui-data-table.md) |
| Form fields, modal, cards, KPI, lists, tabs | [docs/ui-forms.md](docs/ui-forms.md) |
| Update system + notifications | [docs/extension-versioning.md](docs/extension-versioning.md) |
| chrome-devtools-mcp setup | [docs/dev-mcp.md](docs/dev-mcp.md) |
| What does module X check exactly | `services/web-checker/modules/<x>/README.md` |
