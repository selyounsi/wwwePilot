---
name: webchecker-module
description: Create or modify a web-checker module in the extension (DOM audit modules like headings, images, links). Covers module.json, index.js exports, page-context constraints, _meta markers, translations.
---

# Web-checker module workflow

Location: `extension/src/services/web-checker/modules/<id>/`.
Reference implementation: `modules/headings/` (small, complete).

## Required files (auto-discovery via useModuleLoader)

```
modules/<id>/
  module.json                    ← REQUIRED (active: true or module is skipped)
  index.js                       ← REQUIRED (default export = check function)
  views/Index.vue                ← REQUIRED (detail view)
  translations/translations.json ← module strings (de/en)
  components/                    ← optional sub-components
  README.md                      ← what the module checks + edge cases
```

`module.json` (real example):

```json
{
  "id": "headings",
  "name": "Headings",
  "description": "Check H1-H6 structure",
  "icon": "mdiFormatHeader1",
  "active": true,
  "checkOnReload": true,
  "allowChatBot": true,
  "defaultFilter": "issues"
}
```

Discovery: `useModuleLoader` globs `@/services/*/modules/*/{module.json,index.js,views/Index.vue}`;
missing index.js or Index.vue → console.warn + module skipped. Modules
are also gated by the feature flag `module.web-checker.<id>` (backend-
controlled). `order` in module.json controls sort position.

## index.js export shape

```js
export const overlay = {            // optional page badges
  enabled: true,
  labelFn: (item) => item.tag,
  onText:  'Hide tags',
  offText: 'Show tags',
}

export const claude = {             // optional "explain in chat" prompt
  title: 'Heading-Vorschlag',
  systemPrompt: 'You are … Reply in German …',
}

export const apiConfig = { … }      // optional; passed as arg into the checker

export default function check(apiConfig) {   // THE check, runs in PAGE context
  const { errors, warnings, items, addItem, finish } = createCheckResult()
  const t = window.__t
  // …inspect document…
  return finish()
}
```

## Page-context constraints (CRITICAL)

The default export is executed via
`chrome.scripting.executeScript({ target: {tabId}, func: mod.checker, args: [apiConfig] })`
— i.e. serialized with `Function.toString()`:

- **NO module imports, NO closures over file-scope variables.** Only
  what's inside the function body + the injected globals.
- Injected globals (set up by `useCheckRunner` before the run):
  `window.__t` (translator), `window.__translations`,
  `window.__ignoreSelectors` (array of CSS selectors to skip),
  `window.__moduleSettings` (snapshot of all module settings),
  `window.createCheckResult()` (returns
  `{ errors, warnings, items, addItem, finish }`).
- Honor the ignore list:
  `const isIgnored = (el) => window.__ignoreSelectors.some(sel => { try { return !!el.closest(sel) } catch { return false } })`
- Return value must be `finish()`'s plain JSON (structuredClone'd back).

## Per-item `_meta` markers (REQUIRED on every item)

`addItem(el, checks, extra)` — `extra` must contain
`_meta: { tag, idx }` (idx = index among ALL elements with the same
tag: `Array.from(document.querySelectorAll(h.tagName)).indexOf(h)`) or
`_meta: { selector }`. Without it, markers/highlight collide on lists
with identical attributes. Lookup happens in
`useModuleAttributes.findEl`. `addItem`'s `checks` is an array of
`{ when, type: 'error'|'warning'|'success', title, description }` —
first matching `when` wins.

## Views + settings + i18n

- `views/Index.vue` renders results from `useCheckStore` (single check)
  — hydrated from `useSiteCheckStore` after site-checks.
- Persistent module settings:
  `useModuleSettings('<id>', { myFlag: true })` → reactive object,
  auto-persisted to `chrome.storage.local`, auto-injected into page
  context as `window.__moduleSettings['<id>']`.
- Strings: `t()` from `@/composables/i18n/useI18n.js` in Vue,
  `window.__t('…', { params })` in page context. Keys are the English
  strings; add `de` entries in `modules/<id>/translations/translations.json`
  (`{ "de": { "English key": "Deutscher Text" }, "en": {} }`).

## Docs first — most answers live there

| Frage | Doc |
|---|---|
| Page-context helpers (apiConfig, was in index.js erlaubt ist) | [docs/module-api.md](../../../docs/module-api.md) |
| Neues Modul Schritt fuer Schritt | [docs/creating-a-module.md](../../../docs/creating-a-module.md) |
| Wie Seiten erkannt werden (CMS4/Shop/…) | [docs/page-detector.md](../../../docs/page-detector.md) |
| Re-Check-Flow, Tab-Handling, Site-Check | [docs/check-flow.md](../../../docs/check-flow.md) |
| Check-Types (Audit-Profile + manuelle Tasks) | [docs/check-types.md](../../../docs/check-types.md) |
| Uebersetzungen (t() / window.__t) | [docs/i18n.md](../../../docs/i18n.md) |
| Was Modul X genau prueft | `modules/<x>/README.md` |

## Checklist

1. Create/edit files per anatomy above; keep README.md current.
2. Every item gets `_meta` — test on pages with repeated identical elements.
3. `npm run dev` (or build) → reload extension → verify via the
   `extension-live-test` skill.
4. Bump `manifest.json#version` + doc update (`ship-change` skill).
