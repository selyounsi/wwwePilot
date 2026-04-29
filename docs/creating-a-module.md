# Creating a new module

Step-by-step guide for adding a new check to the Web Checker.

> Read [architecture.md](./architecture.md) first for the big picture, then
> use this as the practical recipe.

## Quick recipe (no service worker needed)

For a check that only walks the DOM and doesn't need network access.

### 1. Create the directory

```
src/services/web-checker/modules/<your-id>/
├── module.json
├── index.js
├── Index.vue
└── components/
    └── YourItem.vue
```

The directory name doesn't have to match `<your-id>` but the convention
keeps things tidy.

### 2. `module.json`

```json
{
  "id":            "my-check",
  "name":          "Mein Check",
  "description":   "Was prüft das Modul",
  "icon":          "mdiCheck",
  "active":        true,
  "order":         50,
  "checkOnReload": false,
  "allowChatBot":  true,
  "defaultFilter": "issues"
}
```

| Key | Meaning |
|---|---|
| `id` | Internal identifier — must be unique, kebab-case |
| `name` | Display name in the dashboard / module page |
| `description` | One-line subtitle on the dashboard |
| `icon` | MDI icon name from [pictogrammers.com/library/mdi](https://pictogrammers.com/library/mdi/) |
| `active` | Set to `false` to hide the module without deleting it |
| `order` | Sort order on the dashboard (lower = earlier) |
| `checkOnReload` | Re-run automatically when the page reloads |
| `allowChatBot` | Show "Im Chat analysieren" button on items |
| `defaultFilter` | Initial filter: `'issues'` / `'errors'` / `'warnings'` / `'all'` |

### 3. `index.js` — the checker

```js
export const overlay = null   // or a config object — see below

export default function check() {
  const { errors, warnings, items, addItem, finish } = createCheckResult()

  document.querySelectorAll('h1').forEach((h, idx) => {
    const text = (h.innerText || '').trim()

    addItem(h, [
      { when: !text,        type: 'error',   title: 'H1 ist leer' },
      { when: text.length < 10, type: 'warning', title: `H1 zu kurz: "${text}"` },
      { when: true,         type: 'success', title: text },
    ], {
      tag:  h.tagName,
      text,
      _meta: { tag: 'H1', idx },   // so overlays/highlight can find it later
    })
  })

  return finish()
}
```

This function runs in the **page context** of the website being checked.
That means:

- ✅ You have full DOM access via `document`, `window`, `getComputedStyle`,
  `XMLHttpRequest`, `fetch`, `chrome.runtime.sendMessage`, …
- ❌ You **cannot** use module-scope `import`s — anything outside the
  `check()` function body is lost when the function is serialised
- ❌ You **cannot** use bundler features like `import.meta.env`

If you need a constant, declare it **inside** `check()`. If you need a
helper function, declare it inside `check()` too.

The framework injects a few useful helpers as `window.*` globals before
your checker runs (see [module-api.md](./module-api.md) for the full list):

- `createCheckResult()` — what you saw above
- `setHighlightElement()` — returns a UUID you typically don't need to
  call yourself; `addItem` calls it for you
- `isElementVisible(el)` — recursive visibility check
- `hasVisualContent(el)` — detects icon-styled empty elements
- `runInBackground(type, payload)` — call a service-worker handler

### 4. `Index.vue` — the sidebar page

```vue
<script setup>
import YourItem from './components/YourItem.vue'
</script>

<template>
  <ModulePage moduleId="my-check" label="Mein Check" :itemComponent="YourItem" />
</template>
```

That's it. `<ModulePage>` handles the AppHeader, idle / running / done
states, ModuleStats, and the items loop.

For more elaborate views, override the default slot:

```vue
<template>
  <ModulePage moduleId="my-check" label="Mein Check">
    <template #default="{ result, raw }">
      <CustomStats :result="raw ?? result" />
      <YourGroupedView :items="result.items" />
    </template>
  </ModulePage>
</template>
```

### 5. `components/YourItem.vue` — display per item

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })

const normalized = computed(() => ({
  ...props.item,
  title:   props.item.text || props.item.tag,
  details: '',
}))
</script>

<template>
  <ModuleItem :item="normalized" variant="box">
    <template #expand>
      <div class="bg-surface-soft border-t border-border/40 px-3 py-2.5 flex flex-col gap-2">
        <DetailRow label="Tag">{{ item.tag }}</DetailRow>
        <DetailRow v-if="item.text" label="Text">{{ item.text }}</DetailRow>
      </div>
    </template>
  </ModuleItem>
</template>
```

### 6. Done

Your module appears in the dashboard automatically — no router setup, no
loader registration. Vite picks it up via `import.meta.glob`.

---

## Recipe: module that needs a service worker

Use this when your check needs `chrome.tabs.captureVisibleTab`, `fetch` to
external APIs without CORS issues, persistent storage, or anything else
that requires the service-worker context.

### Add `background.js`

```js
export const type = 'MY_CHECK_FETCH'

export async function handle(msg, sendResponse, sender) {
  // sender.tab.id is the tab that originated the call
  try {
    const data = await fetch(msg.url).then(r => r.json())
    sendResponse({ data })
  } catch (e) {
    sendResponse({ error: e.message })
  }
}
```

### Call from your checker

```js
export default async function check() {
  const reply = await runInBackground('MY_CHECK_FETCH', { url: 'https://api.example.com' })

  if (reply?.error) {
    return { errors: [{ message: reply.error }], warnings: [], errorCount: 1, warningCount: 0, items: [] }
  }

  const { addItem, finish } = createCheckResult()
  // ...use reply.data...
  return finish()
}
```

The framework's auto-loader picks up any `background.js` file in
`services/*/modules/*/background.js` and registers it by its exported
`type`. No manifest tweaks needed.

---

## Recipe: module with overlay badges

Add an `overlay` export with a `labelFn`:

```js
export const overlay = {
  enabled: true,
  labelFn: (item) => item.text ? `Text: ${item.text}` : '⚠ Kein Text',
  onText:  'Ausblenden',
  offText: 'Einblenden',
}
```

The user sees a toggle on the module page. When active, every item that
matches `_meta` lookup gets a coloured speech-bubble badge above its
element on the page.

Click on a badge → the sidebar navigates to the matching item and scrolls
it into view (handled centrally in `App.vue`).

---

## Conventions and gotchas

### File naming

- `index.js` (lowercase) for the checker
- `Index.vue` (capital) for the sidebar page
- The case difference is intentional — Vite distinguishes them

### Item-finding via `_meta`

Always set `_meta` so overlays and the chatbot's HTML extraction can find
the element later. Common patterns:

```js
// Tag-and-index lookup (most common)
{ _meta: { tag: 'A', idx: 5 } }

// Direct CSS selector (for elements you injected yourself)
{ _meta: { selector: '#my-injected-span' } }

// Background-image divs (no <img> child)
{ _meta: { isBackground: true, idx: 2 } }

// Image lookup by filename / alt
{ _meta: { src: '/logo.svg', name: 'logo.svg', alt: 'Logo' } }
```

### Severity rules

- `type: 'error'` — broken or critical issue (red)
- `type: 'warning'` — improvement opportunity (orange)
- `type: 'success'` — passes (green, only shown when filter is "all")

### Don't import in the checker

Module-scope imports are stripped during serialisation. Either:

- Put helpers inside the `check()` function
- Pass values via `args` from the runner (set `apiConfig` export)

```js
import { API } from '@/config/api.js'
export const apiConfig = { url: API.myApi.url }   // ✓ passed as arg

export default async function check(config) {
  const url = config.url   // ✓ available
}
```

### Use `runInBackground` instead of raw `sendMessage`

The framework provides `runInBackground(type, payload)` as a
promise-wrapped shortcut. Prefer it:

```js
// Old (still works)
const reply = await new Promise(resolve =>
  chrome.runtime.sendMessage({ type: 'X', foo }, resolve)
)

// New (preferred)
const reply = await runInBackground('X', { foo })
```

### Add a README

Every module gets a `README.md` next to its `module.json`. Briefly
document **what** it checks, **why** (especially non-obvious heuristics),
and **known limitations**. Future-you and contributors will thank you.
