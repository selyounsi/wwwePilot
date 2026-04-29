# Architecture

How the wwweBar Chrome Extension is organised.

## Big picture

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Side Panel (Vue 3 SPA)                              │
│  ───────────────────────────                                │
│  Dashboard → Service → Module → Items                       │
│                                                             │
│  All Vue + Vite + Tailwind + CRXJS                          │
└─────────────────────────────────────────────────────────────┘
                          ↓ chrome.runtime.sendMessage
┌─────────────────────────────────────────────────────────────┐
│  Service Worker (background.js)                             │
│  ──────────────────────────────                             │
│  Auto-loads handlers from each module's background.js,      │
│  routes messages to them by `type`.                         │
└─────────────────────────────────────────────────────────────┘
                          ↓ chrome.scripting.executeScript
┌─────────────────────────────────────────────────────────────┐
│  Page Context (the website being checked)                   │
│  ──────────────────────────────────────                     │
│  Each module's checker function runs here with access to    │
│  the real DOM via window helpers (createCheckResult,        │
│  setHighlightElement, hasVisualContent, runInBackground).   │
└─────────────────────────────────────────────────────────────┘
```

## Three execution contexts

The extension runs code in three distinct JavaScript contexts that talk
to each other only via `chrome.*` APIs.

| Context | Where it lives | What it can do |
|---|---|---|
| **Sidebar** | `src/App.vue` and below | Vue UI, routing, store, can call `chrome.scripting.executeScript` and `chrome.runtime.sendMessage` |
| **Service Worker** | `src/background.js` + each `*/background.js` | Persistent across tabs, owns network calls to external APIs, `chrome.tabs.captureVisibleTab`, `chrome.scripting.executeScript`, `chrome.storage` |
| **Page Context** | injected by `chrome.scripting.executeScript` | Runs in the website's isolated world, has direct DOM access, *does not* share JS scope with the sidebar |

The page-context functions are **serialised via `Function.prototype.toString()`**
and re-parsed in the target tab. That means:

- Module-scope `import`s and `const`s outside the function body are **lost**
- All constants, helpers and config the checker needs must live **inside** the
  function or be passed via `args`
- Window helpers (`window.createCheckResult` etc.) are pre-injected once via
  `useCheckRunner.injectHelper` so checkers can use them without re-defining

## Data flow of a single check

```
User clicks "Prüfung starten" in dashboard
            │
            ▼
useWebChecker.runChecks()           ─── sidebar
  • setRunning(modId) for each
  • injectHelper(tabId)             ─── injects window.createCheckResult,
  • Promise.all(modules.map(...))       window.setHighlightElement,
            │                          window.hasVisualContent,
            │                          window.runInBackground
            ▼
chrome.scripting.executeScript({func: mod.checker})  ─── page context
            │
            ▼
mod.checker() runs in the page
  • walks the DOM
  • calls createCheckResult / addItem
  • optionally: runInBackground('CHECK_X', payload)  ─── service worker
            │
            ▼
returns { errors, warnings, errorCount, warningCount, items }
            │
            ▼
useCheckStore.setResult(modId, result)              ─── back in sidebar,
            │                                          reactive — UI updates
            ▼
useModuleAttributes.apply()
  • finds each item's element on the page (via _meta)
  • writes data-${prefix}-* attributes for overlay lookup
```

## Module system

Each module is a **self-contained directory** under
`src/services/web-checker/modules/<id>/`:

```
links/
├── module.json                ← static config (id, name, icon, allowChatBot, ...)
├── index.js                   ← page-context checker function (default export)
├── Index.vue                  ← sidebar page (usually a one-liner around <ModulePage>)
├── background.js              ← optional: service-worker handler for sendMessage
├── components/
│   └── LinkItem.vue           ← per-item display
└── README.md                  ← what does it check, edge cases, why
```

Modules are **auto-discovered** via Vite's glob imports (`import.meta.glob`).
Drop a new directory in `modules/` and it appears in the dashboard — no
registration needed.

## Static vs dynamic config

Each module has two kinds of configuration:

| **Static** (in `module.json`) | **Dynamic** (in `index.js`) |
|---|---|
| `id`, `name`, `description`, `icon` | `overlay = { labelFn, onText, offText }` (functions can't go in JSON) |
| `active`, `order` | `apiConfig = { ... }` (values that come from imports) |
| `checkOnReload`, `allowChatBot`, `defaultFilter` | `default function check()` (the checker itself) |

The loader merges both with module.json winning when both define the same key.

## Shared building blocks

Things that **multiple modules** use, exposed as either Vue components or
window helpers (depending on which context they run in):

### Vue components (sidebar)
- **`<ModulePage>`** — wraps AppHeader + ModuleSection + idle/running/done
  states. Reduces a typical module's `Index.vue` from ~25 lines to 1-3.
- **`<ModuleSection>`** — the inner part: filter dropdown, recheck button,
  overlay toggle, items slot.
- **`<ModuleItem>`** — single result row. Handles status colour, expand,
  click-to-highlight, "Im Chat analysieren" button.
- **`<DetailRow>`** — labelled key-value row used inside item expand views.
- **`<ModuleStats>`** — Gesamt / Fehler / Warnungen badges.

### Window helpers (page context, injected by `injectHelper`)
- **`createCheckResult()`** — returns `{ errors, warnings, items, addItem,
  finish }`. The framework's contract for module results.
- **`setHighlightElement()`** — returns a fresh UUID used as the element id.
- **`isElementVisible(el)`** — recursive visibility check (display, opacity,
  hidden ancestors, transforms).
- **`hasVisualContent(el)`** — does the element render anything? (text, child
  media, ::before/::after content, background-image)
- **`runInBackground(type, payload)`** — promise-wrapped
  `chrome.runtime.sendMessage` for service-worker calls.

### Composables (sidebar)
- **`useModuleLoader(serviceId)`** — auto-discovers modules of a service,
  merges JSON + JS exports into a unified module object.
- **`useCheckStore()`** — Vue reactive store of `state.results[moduleId]`.
- **`useCheckRunner()`** — `injectHelper(tabId)` to install window helpers.
- **`useModuleSetup(moduleId, ...)`** — wires together overlay + visibility
  watcher + attribute manager for a single module page.
- **`useModuleAttributes(moduleId)`** — writes `data-${prefix}-*` attrs to
  page elements so overlays can find them later.
- **`useModuleOverlay(moduleId, overlayConfig)`** — toggles the badge layer.
- **`useModuleFilter(result, defaultFilter)`** — applies the user's
  Errors/Warnings/All filter and severity-sorts.
- **`useTabWatcher(modules)`** — re-runs `checkOnReload` modules when the
  tab finishes loading.
- **`useVisibilityWatcher(moduleId)`** — polls visibility of items in case
  the page lazy-loads or scrolls.

## Element identification

Each result item has an `element` field containing a UUID generated by
`setHighlightElement()`. After a check completes:

1. `useModuleAttributes.apply()` writes `data-${prefix}-id="<uuid>"` and a
   handful of related attrs onto the corresponding page element.
2. The overlay system looks up elements by that attribute.
3. The "Im Chat analysieren" button strips those same attrs before sending
   the element's HTML to the chatbot.

The element is **found** via the `_meta` field on each item, which a module
sets when it calls `addItem`. The framework supports several lookup
strategies in priority order (see `useModuleAttributes.findEl`):

- `meta.selector` — direct CSS selector (used by spellcheck for its
  injected spans)
- `meta.tag` + `meta.idx` — the n-th element of that tag (used by headings
  and most modules)
- `meta.text` + `meta.tag` — text-based fallback (contrast)
- `meta.isBackground` + `meta.idx` — for `<div>`-with-bg-image items (images
  module)
- `meta.src` / `meta.name` / `meta.alt` — image-based heuristic

## Parallel execution and ID safety

All modules run in parallel via `Promise.all`. To avoid ID collisions across
parallel runs, `setHighlightElement` returns `crypto.randomUUID()` — there
is no shared counter, so parallel `addItem` calls in different modules
cannot overwrite each other's IDs.

## See also

- [creating-a-module.md](./creating-a-module.md) — step-by-step guide
- [module-api.md](./module-api.md) — full API reference for module authors
