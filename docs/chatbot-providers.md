# Chatbot-Provider

Die Chat-Service-Architektur erlaubt mehrere Provider parallel (aktuell
`workingguide` und `claude`). Jeder Provider lebt unter
`src/services/chatbot/modules/<id>/` und folgt dem Provider-Modul-Vertrag in
[module-api.md](./module-api.md#chatbot-provider-modul).

## Provider an-/ausschalten

Pro User persistiert in `chrome.storage.local` unter Schlüssel
`wp-chatbot-providers:<userId>`. Default: alle Provider aus `module.json` mit
`active: true` sind global aktiv, der User kann sie individuell deaktivieren.

UI: **Settings → Chat → Aktive Chatbots**. Pro Provider ein Toggle. Wenn alle
Provider deaktiviert sind, zeigt der Chat-Tab eine Empty-State mit
„Chat-Einstellungen öffnen"-Button.

### Composable

```js
import { useChatbotProviders } from '@/services/chatbot/composables/useChatbotProviders.js'

const {
  modules,         // alle in module.json registrierten Provider
  enabledModules,  // computed: nur die vom User aktivierten
  anyEnabled,      // computed: true wenn mindestens einer aktiv
  isEnabled,       // (id) => boolean
  setEnabled,      // (id, bool) => void
} = useChatbotProviders()
```

Der Provider-Switcher (`ProviderToggle.vue`) zeigt bei mehreren aktiven
Providern klickbare Tabs; bleibt nur **ein** Provider übrig, wird daraus ein
statischer Chip mit Icon + Name (seit 0.0.124). So bleibt sichtbar, mit wem
man spricht, und die Header-Zeile wirkt neben den Aktions-Icons nicht leer.

### Hydration

`whenChatbotProvidersHydrated()` wird in [main.js](../src/main.js) abgewartet,
bevor die App mountet — sonst rendert der Chat mit dem falschen
Default-Provider.

## Chat-UI: Verläufe, Titel, Fehler (0.0.123)

- **Auto-Titel:** Ein Chat wird nach der ersten User-Nachricht benannt
  (max. 48 Zeichen). Bis dahin heißt er „Neuer Chat". `createdAt` steht am
  Chat-Objekt; der Verlauf zeigt heute die Uhrzeit, sonst das Datum, plus
  Nachrichtenzahl.
- **Verlauf-Panel:** Löschen pro Chat ist immer sichtbar (kein Hover-Reveal
  mehr, auch beim letzten Chat). „Alle löschen" ist zweistufig — der Button
  wird 5 s scharf („Wirklich alle löschen?") und löscht erst beim zweiten
  Klick (`deleteAllChats()`).
- **Fehler sind System-Zeilen, keine Chat-Bubbles:** `msg.isError` rendert
  als Hinweis-Box mit Icon; der „Erneut versuchen"-Button hängt direkt daran
  (nur an der letzten Nachricht). `retryLast()` entfernt erst die Fehlerzeile
  nach der letzten User-Nachricht und sendet dann mit `resend: true` — die
  User-Bubble wird nicht dupliziert.
- **Provider liefern menschenlesbare Fehlertexte:** `workingguide/index.js`
  mappt Status (502/503/504 → Dienst nicht erreichbar, 401/403 → Session
  abgelaufen) statt `HTTP 502` durchzureichen. `useChat` zeigt `result.error`
  unverändert an.
- **Nachrichten-Gruppierung:** Aufeinanderfolgende Nachrichten gleicher Art
  bilden eine visuelle Gruppe — Assistant-Avatar nur an der ersten, engerer
  Abstand innerhalb der Gruppe. User-Nachrichten haben keinen Avatar und
  eine gefüllte Primary-Bubble.
- **Input:** Autofokus; der Zeichenzähler erscheint erst ab 80 % des Limits.

## Auswirkungen auf andere UI-Stellen

- **`<ClaudeButton>`** prüft `isEnabled('claude')` über `useClaude` und rendert
  nur wenn Claude vom User aktiviert ist. Siehe [claude-actions.md](./claude-actions.md).
- **„Im Chat analysieren"-Buttons** auf Web-Checker-Items zeigen nur, wenn
  `anyEnabled === true` (= mindestens ein Provider aktiv).
- **Module-Konfig** kann Chatbot-Buttons modul-weise abschalten via
  [`actions.chatbot: false`](./module-api.md#modulejson) im jeweiligen
  `module.json`.

## CMS4-MCP-Tools im Claude-Provider

Seit 0.0.117 kann der Claude-Chat den **CMS4 Live-Editor direkt bedienen** —
über den [MCP-Connector der Anthropic Messages API](https://platform.claude.com/docs)
(Beta-Header `mcp-client-2025-11-20`). Anthropic verbindet sich serverseitig
mit unserem MCP-Server; die Extension implementiert keinen eigenen Tool-Loop.

Ablauf:

1. **Backend liefert die Server-Liste**: `GET /api/config/mcp` (JWT) gibt
   Einträge im `mcp_servers`-Format der API zurück (`type`, `name`, `url`,
   `authorization_token`). Quelle: `CMS_MCP_URL` + `CMS_MCP_TOKEN` in der
   Backend-`.env`. Kein Token im Extension-Code oder in `chrome.storage` —
   [`useMcpConfig.js`](../src/services/chatbot/modules/claude/composables/useMcpConfig.js)
   hält die Antwort nur in-memory pro Panel-Session.
2. **Provider reicht durch**: `index.js#send()` hängt `mcpServers` an die
   `CLAUDE_CHAT`-Message, wenn der Settings-Toggle „CMS-Tools" aktiv ist
   (`useModuleSettings('claude').cmsToolsEnabled`, Default: an).
3. **Background-Script baut den Request**: bei aktiven Servern kommen
   `mcp_servers` + `tools: [{type: 'mcp_toolset', …}]` + der Beta-Header in
   den Messages-Call, `max_tokens` steigt auf 4096. `stop_reason:
   "pause_turn"` wird bis zu 5× fortgesetzt (Server-Tool-Loop der API).
4. **Antwort**: alle Text-Blöcke werden zusammengefügt; verwendete
   MCP-Tools werden als kursive Fußzeile unter der Antwort gelistet
   (`mcp_tool_use`-Blöcke).

Voraussetzungen: eingeloggt (JWT für den Config-Fetch), Claude-API-Key
hinterlegt, MCP-Server von Anthropics Infrastruktur aus erreichbar
(öffentliche URL). Fehlt eine der Zutaten, läuft der Chat unverändert ohne
Tools weiter.

## Fähigkeiten pro Chat + sichtbarer Fortschritt (0.0.118)

### Auswahl beim neuen Chat

Jeder Chat trägt seine eigenen `capabilities` (`useChat.js#newChatObj`):
`{ cms4: false, target: 'activeTab' }`. Im leeren Chat rendert
[ChatCapabilities.vue](../src/services/chatbot/components/ChatCapabilities.vue)
die Auswahl („Keine zusätzlichen Tools" / „CMS4-Tools"). Bei aktiven CMS4-Tools
erscheint darunter das Ziel — aktuell „Aktueller Tab" mit dem **aufgelösten
Hostnamen**, damit unmissverständlich ist, auf welcher Seite gearbeitet wird.
Sobald der Chat Nachrichten hat, ersetzt ein kompakter Header-Chip die Auswahl.
Weitere Ziele (fester Domain-Eintrag, Sitemap-Auswahl) lassen sich als weitere
`target`-Werte ergänzen.

Zwei Ebenen entscheiden über die Tools: das globale Modul-Setting
(`useModuleSettings('claude').cmsToolsEnabled`) ist der Master-Schalter, die
Chat-`capabilities` entscheiden pro Unterhaltung. Der Hostname landet über den
System-Prompt beim Modell — die MCP-Tools adressieren Seiten per Domain, nicht
per Tab-ID.

**Die Bindung ist bewusst endgültig.** Beim Aktivieren werden `pinnedHost`,
`pinnedTabId` und `pinnedUrl` eingefroren; es gibt **keinen** Weg, einen
laufenden Chat auf eine andere Domain umzustellen — ein versehentlicher Wechsel
könnte eine Änderung auf der falschen Website ausführen. Wer eine andere Seite
bearbeiten will, startet einen neuen Chat. Weicht der aktive Tab von der
Bindung ab, zeigen Auswahl und Header-Chip stattdessen einen
**„Zurück zum Tab"**-Button: `focusOrOpenTab()` aktiviert die gepinnte Tab-ID,
fällt auf einen beliebigen Tab derselben Domain zurück und öffnet die Seite
notfalls neu — ein geschlossener Tab strandet den Chat also nicht.

### Statusmeldungen während Tool-Aktionen

`chrome.runtime.sendMessage` kann nur **einmal** antworten — deshalb läuft ein
Chat-Turn über einen **Port** (`chrome.runtime.connect({ name: 'claude-chat' })`)
mit `stream: true`. Der Background-Handler parst SSE und postet echte Events:

| Event | Auslöser | Anzeige |
|---|---|---|
| `text` | abgeschlossener Text-Block | eigene Chat-Nachricht |
| `tool_start` | `content_block_start` mit `mcp_tool_use` | Statuszeile mit Spinner |
| `tool_end` | `content_block_stop` desselben Blocks | dieselbe Zeile mit Haken |
| `done` / `error` | Turn fertig bzw. Fehler | beendet den Ladezustand |

Das sind **reale Workflow-Zustände** (Claudes nutzergerichteter Text + echte
Tool-Events), keine internen Reasoning-Inhalte. Statusnachrichten tragen
`kind: 'status'` und werden aus der History gefiltert, bevor der nächste Turn
rausgeht.

**Robustheit:** MV3-Service-Worker schlafen nach ~30 s Idle ein — ein
`getPlatformInfo()`-Ping alle 20 s hält ihn für die Dauer des Requests wach.
Schließt das Panel, bricht ein `AbortController` den Fetch ab. Bricht der Port
ab, **bevor** etwas gestreamt wurde, fällt der Provider automatisch auf den
alten `CLAUDE_CHAT`-Pfad (nicht streamend) zurück; offene Spinner werden im
`finally` beendet.

### Folge-Kontext: Tool-Blöcke wandern mit (0.0.119)

Nach jedem Turn schickt der Background die zusammengesetzten Assistant-Blöcke
(`text`, `mcp_tool_use` inkl. gestitchter `input_json_delta`-Argumente,
`mcp_tool_result`) als `done.blocks` zurück. Der Store parkt sie auf der ersten
Nachricht des Turns (`turnId`) und `buildHistory()` sendet beim nächsten Turn
diese Blöcke statt des reinen Texts — sonst sähe das Modell nur seine eigene
Erzählung und müsste jedes Tool neu aufrufen.

`replayableBlocks()` ist die Sicherung: Nur wenn **jeder** `mcp_tool_use` ein
geparstes `input` **und** ein passendes `mcp_tool_result` hat, werden die Blöcke
freigegeben — andernfalls fällt der Turn auf Text-Blöcke zurück. Ein halb
erfasstes Tool-Paar würde den nächsten Request sonst mit 400 abweisen.

### Abbrechen

Ein laufender Turn kann per `stop()` beendet werden (Button neben dem
Ladeindikator, sichtbar solange `canStop`). Der Provider schickt `ABORT` über
den Port, der Background bricht per `AbortController` ab — bereits gestreamter
Text bleibt stehen. Panel schließen wirkt identisch.

### Statuszeilen-Hygiene

Beim Laden gespeicherter Chats fasst `collapseStatusLines()` die Statuszeilen
eines Turns zu einer Zeile zusammen (`3× search_element_tree, …`) und räumt
hängende Spinner ab. Live-Fortschritt bleibt unverändert; nur der Verlauf wird
kompakt und das localStorage-Budget geschont.

### Request-Config kommt aus dem Backend

Modell, Endpoint, Beta-Header, Token-Limits, Resume-Cap und die System-Prompts
liefert `GET /api/config/mcp` (JWT). Ein Modellwechsel ist damit eine
Backend-`.env`-Änderung statt eines Extension-Releases für alle Mitarbeiter.
Der `chat`-Block wird in `chrome.storage.local` gespiegelt (enthält keine
Secrets), damit der Service Worker ihn nach einem Neustart hat; die MCP-Server
mit Bearer-Token bleiben nur im Speicher. Die Konstanten in
`useMcpConfig.js#FALLBACK_CHAT_CONFIG` greifen nur offline oder vor dem ersten
erfolgreichen Fetch.

