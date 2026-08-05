---
name: extension-live-test
description: Live-test the EverWise Chrome extension via chrome-devtools MCP — install from dist/, open the side panel, run a web-check, inspect console/network. Use whenever a change should be verified in a real browser.
---

# Live-test the extension via chrome-devtools MCP

Full background: `extension/docs/dev-mcp.md`. This is the distilled,
battle-tested flow.

## Preconditions

- MCP tools `mcp__chrome-devtools__*` must be mounted. If `ToolSearch`
  finds none, the server wasn't mounted at session init — cannot be
  fixed at runtime. Tell the user to restart the session; meanwhile
  work statically and ask them to test manually.
- **Build preference (user request 2026-08-05): `npm run dev` first,
  `npm run build` as fallback.** Use the dev watcher (background shell)
  when port 5173 is free — auto-rebuild + `reload_extension` on changes.
  If the port is taken (other Vite projects; vite.config.js pins 5173
  with `strictPort`), fall back to `npm run build` — fully sufficient
  since 2026-08 (prod-build pages survive CDP touch, re-verified through
  a full check flow). Dev mode on a busy machine still works via
  `VITE_DEV_PORT=5176 npm run dev` (sets server port + hmr.clientPort
  together). Don't assume a busy 5173 IS the extension dev server —
  verify via `(Get-CimInstance Win32_Process -Filter "ProcessId = <pid>").CommandLine`.
- Backend up? `curl http://localhost:3000/health` → `{"ok":true}`.
  With `oidcConfigured: false` (`/api/auth/config`) login is stub mode:
  one click signs in as superadmin "Stub User" (stub@everwise.de).
- **Test site (user-provided, one of theirs):**
  `https://selyounsi-demosite-com.duess5.dfsweb.site/` — CMS4 v1.9.3,
  has a sitemap (44 URLs) and real findings (duplicate H1, H2 before
  H1). Prefer it over example.com for meaningful results.

## Standard flow

1. Start `npm run dev` in background if port 5173 is free; otherwise
   `npm run build`. Either way check `dist/manifest.json` version
   matches source — a stale dist means no build ran.
2. `install_extension({ path: "<absolute>/extension/dist" })` — path
   must be absolute, folder must contain `manifest.json`.
3. `new_page` → target URL (page A).
4. `select_page(A)` → `trigger_extension_action(id)` — opens the side
   panel; it appears in `list_pages` as its own page with a
   `chrome-extension://…` URL (page B). `take_screenshot` of page A
   canNOT capture the side panel — it renders outside the tab viewport.
5. `select_page(B)` → `take_snapshot(verbose: true)`.
   **Pitfall:** `StaticText` uids are NOT clickable. Click the wrapping
   `generic` uid that encloses title+badge (only visible with
   `verbose: true`).
6. Click through: service card → "Prüfen"/Start-check button →
   `wait_for(["error","warning","Fehler","Warnung","OK"])`, timeout
   30–60 s.
7. `list_console_messages` for errors, `list_network_requests` +
   `get_network_request` for backend calls (filter `localhost:3000`).

## After code changes

- With prod build: `npm run build` again → `reload_extension`.
- With dev watcher: `dist/` rewrites automatically → `reload_extension`.
- Service-worker or manifest changes: `reload_extension` is NOT enough —
  `uninstall_extension` + `install_extension` again.

## Sidebar-internal state

`evaluate_script` on the side-panel page (B) reaches Vue composable
state; on page A it reaches the audited page's DOM (e.g. check
`data-<app-name>-id` marker attributes set by `useModuleAttributes`).

## Verified click-path (2026-08-05, v0.0.115)

Login button → dashboard ("Hi, Stub!") → service cards (Quick Info /
AI Assistant / Web Checker) → Web Checker: check-type dropdown +
module list + "Start check". Tab-switch triggers "URL changed" banner +
auto-recheck (checkOnReload modules). Module row click → detail view.
Avatar button "SU" → menu → "Open admin area" opens `#/admin/dashboard`
as an extra extension TAB (appears as its own page in `list_pages`).

## Known pitfalls (short list)

- MV3 service workers idle out after ~30 s; `sw-N` target ids shift
  between `list_pages` calls — avoid `evaluate_script` against SW ids,
  prefer the side-panel click flow.
- `trigger_extension_action` can fail with "Target closed" and the MCP
  browser may restart — everything (install, tabs) is gone. Recover:
  `list_pages` → reinstall → reopen. Snapshot uids also go stale after
  view navigation; re-snapshot instead of clicking old uids.
- Backend-dependent modules (spellcheck, performance/PageSpeed, chatbot)
  need the local backend running: `docker compose up -d` in `backend/`.
- Attach-to-running-Chrome mode (`--browser-url`) disables all
  extension tools — only the isolated default profile supports
  `install_extension` etc.
