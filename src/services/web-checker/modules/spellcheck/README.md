# Spellcheck module

Spelling and grammar checks via the LanguageTool API.

## What it checks

1. Walks the DOM and extracts visible text
2. Sends the text to the backend's LanguageTool proxy
   (`runInBackground('CHECK_SPELLING', { text, domain, language, images })`)
3. Receives `matches` with offsets, replacements and rule IDs
4. Maps each match to an item with the issue surfaced as error or
   warning depending on the rule's severity

## Element lookup via `_meta.selector`

Spellcheck **injects spans** around misspelled words so users can
highlight them. The injected span carries `data-${prefix}-injected="spellcheck"`
and a unique id. `_meta = { selector: `[data-${prefix}-injected-id="${id}"]` }`
points right at the injected span — no tag/idx walk needed.

The framework cleans up these spans on `useModuleAttributes.remove()` by
unwrapping each span back to a text node.

## Image alt text

Image alt texts are also sent to LanguageTool (rare but useful — typos
in alt text are common). They're identified by their `src` so matches
can be mapped back.

## Custom UI

`Index.vue` groups items by `category` (Rechtschreibung, Grammatik,
Stil, …) with a per-category dismissed-counter. Users can dismiss
individual matches via the `@ignore` / `@addWord` events on `SpellItem`.

## Service worker (`background.js`)

Proxies the request to the backend's `/api/spellcheck/check` endpoint.
The backend handles the actual LanguageTool API call (and adds the
project's custom dictionary).

## Limitations

- Requires the backend running and the `SPELLCHECK_*` env vars set in
  the backend's `.env`.
- Long pages (10k+ characters) can take several seconds — there's a
  `runningMessage` warning the user.
- Dismissing a match is per-session only (not persisted).
- The injected spans alter the DOM. Sites that re-render via
  React/Vue/Angular may overwrite them; recheck after such re-renders.
