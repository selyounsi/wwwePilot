---
name: chatbot-claude
description: Work on the KI-Assistent (chatbot service) — provider modules (Claude, WorkingGuide/n8n), the Claude background port protocol, MCP/CMS4 tools, backend-owned request config, per-chat capabilities with domain pinning, and the employee API-key onboarding. Use for any change under src/services/chatbot/.
---

# KI-Assistent / chatbot service

```
src/services/chatbot/
  components/            ← shared chat UI (ChatCapabilities = tool picker + pinning)
  composables/useChat.js ← chat state: turns, history builder, capabilities, stop()
  modules/
    claude/              ← Claude API provider (direct from the browser)
      background.js      ← THE ONLY FILE that talks to Anthropic
      composables/       ← useClaudeSettings (key), useMcpConfig (backend config)
      views/             ← chat + SettingsView (key onboarding, CMS-tools toggle)
    everwise/            ← WorkingGuide provider (n8n via backend proxy)
```

Docs that answer most questions before code-reading:

| Frage | Doc |
|---|---|
| Provider an/aus, wie Provider gebaut sind | [docs/chatbot-providers.md](../../../docs/chatbot-providers.md) |
| Alle Claude-Aktionen im Web-Checker (Alt-Text, Meta, GDPR …) | [docs/claude-actions.md](../../../docs/claude-actions.md) |
| Mitarbeiter-Onboarding API-Key (SSO, Workspace *Default*) | [docs/claude-api-key.md](../../../docs/claude-api-key.md) |
| CMS4-Erkennung + Live-Editor-Bridge | [docs/live-editor.md](../../../docs/live-editor.md) |
| chrome-devtools-mcp zum Live-Testen | [docs/dev-mcp.md](../../../docs/dev-mcp.md) |

## Load-bearing architecture facts

- **`background.js` is the only Anthropic caller.** UI never fetches the API.
  Communication runs over a long-lived port (`chrome.runtime.connect`, name
  `claude-chat`) with `START` / `ABORT` — NOT `sendMessage`, which allows only
  one response and cannot stream progress.
- **Request config comes from the backend**, not from the extension:
  `GET /api/config/mcp` → cached in `chrome.storage.local` under
  `CHAT_CONFIG_KEY`, merged over `FALLBACK_CHAT_CONFIG`
  (`modules/claude/composables/useMcpConfig.js`). Model, max_tokens, MCP beta
  header, CMS system prompts — all swappable without an extension release.
  **Never hardcode these in the extension again** (user rule 2026-08-06).
- **MCP/CMS4 tools**: the request carries `mcp_servers` + the beta header from
  config; tool progress streams as `content_block_start/stop`, and tool
  correlation uses the **block index** (`idx-${ev.index}`) in both start and
  end events — `block.id` is not reliably present.
- **`pause_turn`** responses are resumed up to `cfg.maxResumes`;
  `replayableBlocks()` guards history replay: only complete
  `mcp_tool_use`+`mcp_tool_result` pairs survive, otherwise text-only.
- **Per-chat capabilities** (`useChat.js#defaultCapabilities`): `cms4` +
  `pinnedHost/pinnedTabId/pinnedUrl`. Once a tab is chosen for CMS4, the chat
  stays pinned to that DOMAIN — no switching; `focusOrOpenTab()`
  (`src/composables/useActiveTab.js`) jumps back or reopens. This prevents
  edits landing on the wrong site.
- **MV3 lifetime**: the service worker idles out after ~30s; a keep-alive ping
  (`getPlatformInfo` every 20s) runs ONLY during an active request.

## Auth split (do not confuse the two)

The chatbot has two independent credentials:

- **Claude API key** — per employee, stored in `chrome.storage.local`, sent
  only to Anthropic (`anthropic-dangerous-direct-browser-access`). Onboarding
  flow + SSO/workspace specifics: `docs/claude-api-key.md`.
- **App-JWT** — for our backend (config endpoint, WorkingGuide proxy). Auth
  composables: `src/composables/auth/` ([docs/auth.md](../../../docs/auth.md)).

Third-party Claude.ai login (OAuth) is prohibited by Anthropic — do not
re-research this; the reasoning is in `docs/claude-api-key.md`.

## Traps already hit

1. `sendMessage` for streaming — impossible, one response only. Port or nothing.
2. Tool spinners never completing: start/end correlated by different ids.
   Always the block **index**, in both events.
3. docker-compose-style `${VAR:-}` empty strings from the backend config
   defeating `??` — `mergeChatConfig` treats `''`/`0` as unset.
4. A 500 from the WorkingGuide provider usually means the n8n upstream is down
   (502 in `/status` under `chatbot:reachability`), not our code.

## Checklist for changes here

1. Config value? Backend first (`config-proxy`), extension reads it.
2. UI strings through `t()` (`translations/translations.json` per module).
3. `manifest.json#version` bump + doc update + live test —
   `ship-change` + `extension-live-test` skills.
