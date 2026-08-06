---
name: ship-change
description: Cross-cutting checklist that applies to EVERY code change in this repo (extension or backend) — version bump, doc pairing, docker rebuild, commit policy. Run through it before declaring any change done.
---

# Ship a change — project-wide checklist

Apply this checklist at the END of every task that touched code, before
telling the user it's done.

## Extension changes (`extension/`)

1. **Bump `extension/manifest.json#version`** (e.g. `0.0.27` → `0.0.28`).
   - `manifest.json` is the single source of truth.
   - NEVER touch `package.json#version` — the `syncPackageVersion` plugin
     in `extension/vite.config.js` syncs it on Vite start.
2. New/changed UI strings go through `t()` (Vue) or `window.__t`
   (page context) with entries in the layer's `translations.json` —
   never hardcoded German.
3. Rebuild for testing: `npm run dev` (watch) or `npm run build`,
   then reload the unpacked extension in `chrome://extensions/`.

## Backend changes (`backend/`)

1. **Rebuild the image — code is baked in, no volume mount:**
   ```bash
   cd backend
   docker compose up -d --build ever-api
   docker logs --tail 30 everwise-ever-api-1
   ```
   Without `--build` the old code keeps running → new routes 404,
   migrations don't run. This is the default reflex when a new
   endpoint returns 404.
2. Schema touched? → follow the `db-schema-change` skill (4 places).
3. New permission? → it lands in the catalog via `module.json#permissions`
   at seed time; admin role gets it auto-granted on boot.

## Both repos

- **Every code change pairs with an MD doc update** — update the
  matching file in `extension/docs/` / `backend/docs/` or the module's
  `README.md`; create a new doc if none fits.
- **Code comments: NONE by default.** Only where the WHY is truly
  non-obvious — then ONE short English line, never multi-line essays.
  Before finishing, re-read your diff and delete every comment that
  restates the code. UI strings stay German via `t()`.
- **Commits & pushes allowed proactively** (user grant 2026-08-05) —
  but an extension push to `main` IS a release (webhook build + update
  banner for all employees): push deliberately and state it in the
  summary. Backend pushes don't auto-deploy. No `--no-verify`, no
  `--amend` after a commit.
- Report what was changed + which doc was updated + the new extension
  version (if bumped) in the final summary.
