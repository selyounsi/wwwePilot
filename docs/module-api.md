# Module API reference

Complete contract for module authors. For the high-level introduction
read [architecture.md](./architecture.md) and the recipe in
[creating-a-module.md](./creating-a-module.md) first.

---

## `module.json`

Static module configuration. Read by `useModuleLoader` at startup.

```jsonc
{
  "id":            "my-check",       // string, required, unique, kebab-case
  "name":          "Mein Check",     // string, required, dashboard label
  "description":   "Was prüft das",  // string, dashboard subtitle
  "icon":          "mdiCheck",       // MDI icon name (camelCase)
  "active":        true,             // boolean, default true. Set false to hide
  "order":         50,               // number, sort order on dashboard
  "checkOnReload": false,            // boolean, re-run when tab finishes loading
  "allowChatBot":  true,             // boolean, show "Im Chat analysieren" on items
  "defaultFilter": "issues"          // 'issues' | 'errors' | 'warnings' | 'all'
}
```

Static keys can also be exported from `index.js` for backward compat (the
loader merges with `module.json` winning).

---

## `index.js`

The module's checker. Runs in the **page context** of the website being
audited.

### Default export — the checker

```ts
type Check = (apiConfig?: any) => Result | Promise<Result>
```

Sync or async. Receives the module's `apiConfig` export (if any) as first
argument.

```js
export default async function check() {
  const { addItem, finish } = createCheckResult()
  // ...
  return finish()
}
```

### Named exports

| Export | Type | Default | Use |
|---|---|---|---|
| `overlay` | `OverlayConfig \| null` | `null` | Enables the badge layer (see below) |
| `apiConfig` | `any` | `null` | Object passed as the first arg to `check()` — use this to pass values from your bundler-imported config (e.g. URLs from `@/config/api.js`) |

### `OverlayConfig`

```ts
interface OverlayConfig {
  enabled: boolean              // master switch
  labelFn: (item) => string     // text shown in the badge above each element
  onText:  string               // button label when overlay is active
  offText: string               // button label when overlay is hidden
}
```

Example:
```js
export const overlay = {
  enabled: true,
  labelFn: (item) => item.tag,
  onText:  'Tags ausblenden',
  offText: 'Tags einblenden',
}
```

---

## Window helpers (page context)

Pre-injected by `useCheckRunner.injectHelper()` before any checker runs.
Available on `window.*` inside your `check()` function.

### `createCheckResult()`

```ts
function createCheckResult(): {
  errors:   { message: string }[]
  warnings: { message: string }[]
  items:    Item[]
  addItem:  (el: Element, checks: Check[], extra?: object) => void
  finish:   () => Result
}

interface Check {
  when:        boolean              // include this check?
  type:        'error' | 'warning' | 'success'
  title:       string               // shown as the issue message
  description?: string              // optional context (not currently rendered)
}

interface Item {
  type:    'error' | 'warning' | 'success'   // worst severity in `issues`
  issues:  { type, message }[]
  visible: boolean                  // result of isElementVisible(el)
  element: string                   // UUID for overlay/highlight lookup
  ...extra                          // anything the module passed in `extra`
}

interface Result {
  errors:       { message: string }[]   // de-duplicated, with (Nx) suffix
  warnings:     { message: string }[]
  errorCount:   number
  warningCount: number
  items:        Item[]
}
```

`addItem(el, checks, extra)`:
- `checks` filters out `when: false` and `type: 'success'` for the issues
  list, then derives the item's overall `type` from worst severity
- `extra` is spread into the item — typically holds display props (`text`,
  `name`, `href`), the `_meta` for element lookup, and module-specific
  fields

### `setHighlightElement()`

```ts
function setHighlightElement(): string   // returns crypto.randomUUID()
```

Returns a fresh UUID. `addItem` calls this for you and stores the result
on `item.element`. You rarely need to call it directly.

### `isElementVisible(el)`

```ts
function isElementVisible(el: Element): boolean
```

Recursive visibility check covering `display`, `visibility`, `opacity`,
zero-scale `transform`, and ancestor visibility. Used internally by
`addItem` to set `item.visible`.

### `hasVisualContent(el)`

```ts
function hasVisualContent(el: Element): boolean
```

Returns `true` if the element renders anything visible — text, child
`<img>/<svg>/<picture>/<video>/<canvas>`, `::before`/`::after` content
(icon fonts), or a background-image (CSS icons).

Useful for distinguishing truly empty elements from icon-styled ones.
Used by `links` to detect icon-only `<a>` tags and by `contrast` to fall
back to the pseudo's colour when the text itself is hidden.

### `runInBackground(type, payload?)`

```ts
function runInBackground(type: string, payload?: object): Promise<any>
```

Promise-wrapped `chrome.runtime.sendMessage`. Calls a service-worker
handler by its `type` and resolves with the handler's response.

```js
const reply = await runInBackground('CHECK_LINKS', { urls })
```

---

## `_meta` — element lookup

The framework needs to find each item's element again later (for
overlays, highlight, "Im Chat analysieren"). The `_meta` field on each
item tells `useModuleAttributes.findEl` how to look it up.

Resolution order (first match wins):

| Strategy | `_meta` shape | When to use |
|---|---|---|
| **CSS selector** | `{ selector: '#x' }` | You injected the element yourself |
| **Tag + index** | `{ tag: 'H1', idx: 3 }` | Most common — n-th element of that tag |
| **Text-based** | `{ text: 'foo', tag: 'P' }` | Text-content match (used by contrast) |
| **Background-image** | `{ isBackground: true, idx: 2 }` | `<div>` with CSS background-image |
| **Image fingerprint** | `{ src, name, alt }` | Image lookup by filename / alt |

Always set `_meta` — without it, badges and HTML extraction won't work.

---

## `background.js` (optional)

Service-worker handler. Auto-loaded by `src/background.js` from any
module's directory.

```ts
export const type: string         // message type to register for

export async function handle(
  msg: any,                       // the message body
  sendResponse: (reply: any) => void,
  sender: chrome.runtime.MessageSender,   // sender.tab.id is the calling tab
): Promise<void>
```

Single type:
```js
export const type = 'AXE_RUN'
export async function handle(msg, sendResponse, sender) {
  sendResponse({ ... })
}
```

Multiple types (one handler):
```js
export const types = ['CLAUDE_KEY_SET', 'CLAUDE_KEY_GET']
export async function handle(msg, sendResponse) {
  switch (msg.type) {
    case 'CLAUDE_KEY_SET': /* ... */ break
    case 'CLAUDE_KEY_GET': /* ... */ break
  }
}
```

The handler can use any `chrome.*` API available to service workers —
`chrome.tabs`, `chrome.scripting`, `chrome.tabs.captureVisibleTab`,
`chrome.storage`, `fetch` (no CORS preflight from SW context), etc.

---

## Sidebar UI components

### `<ModulePage>`

Wraps a module's sidebar page with the standard layout. Props:

| Prop | Type | Default | Use |
|---|---|---|---|
| `moduleId` | String | required | Looks up module config |
| `label` | String | required | Section title |
| `itemComponent` | Vue Component | null | Rendered for each `result.items[i]` |
| `runningMessage` | String | '' | Optional caption shown below the spinner |
| `emptyMessage` | String | "Noch nicht geprüft …" | Shown in idle state |
| `showStats` | Boolean | true | Show ModuleStats above the items |

Default slot receives `{ result, raw }` for full custom rendering.

### `<ModuleSection>`

Inner part: filter dropdown, recheck button, overlay toggle, items slot.
You normally don't use this directly — `<ModulePage>` wraps it.

Slot exposes `{ result, raw }`:
- `result` — possibly filtered, what the user wants to see
- `raw` — unfiltered, use for stats / total counts

### `<ModuleItem>`

Single result row. Use inside an item-component:

```vue
<ModuleItem :item="normalized" variant="box">
  <template #expand>
    <DetailRow label="Foo">{{ item.foo }}</DetailRow>
  </template>
</ModuleItem>
```

Variants: `'box'` (rounded card) or `'list'` (flat list row).

The component derives display fields from the item:
- `title` from `item.title ?? item.text ?? item.name ?? item.href`
- `details` from `item.details ?? item.tag ?? item.href`
- `image` from `item.image ?? item.src`
- Status colour from `item.issues` (worst type)

### `<DetailRow>`

Labelled key-value row used inside item expand views.

```vue
<DetailRow label="Selector" mono width="w-24">
  {{ selector }}
</DetailRow>
```

Props:
- `label` (required) — left-side label text
- `width` — Tailwind width class for label, default `w-20`
- `mono` — boolean, applies `font-mono` to the label

Slot is the value (right side).

### `<ModuleStats>`

Gesamt / Fehler / Warnungen badges. Props:

| Prop | Default | Use |
|---|---|---|
| `result` | required | Item array container |
| `total` | true | Show "Gesamt" badge |
| `errors` | true | Show "Fehler" badge |
| `warnings` | true | Show "Warnungen" badge |

Default slot for additional StatBox cells.
