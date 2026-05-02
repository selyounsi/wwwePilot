# Dev-Tooling: chrome-devtools-mcp

Anleitung, um die Extension mit Claude Code (oder Claude Desktop, Cursor, …) per
[chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
**automatisiert zu testen und zu debuggen**.

> Nicht zur Laufzeit-Integration in die Extension — chrome-devtools-mcp ist ein
> externer Node-Prozess, kein Code in der Extension. Die Extension selbst
> bleibt unverändert.

## Was ist chrome-devtools-mcp?

Ein MCP-Server (Anthropic Model Context Protocol), der ~30 Chrome-DevTools-Tools
für AI-Agents bereitstellt: Navigation, Click/Type/Fill, Screenshots,
Performance-Traces, Lighthouse-Audits, Console-Messages, Network-Inspection,
Extension-Management. Steuert Chrome via Puppeteer + CDP.

Konkret heißt das: **du kannst Claude Code bitten, "lade die Extension, öffne
wwwe.de, klicke das Side-Panel auf, starte einen Web-Check, schaue dir die
Console an" — und das passiert wirklich.**

## Setup

### 1. Voraussetzungen

- Node.js ≥ 22.12 (für `npx`)
- Chrome installiert
- Claude Code läuft im Repo-Root (oder im `extension/` Ordner)

### 2. MCP-Server aktivieren

Die Konfiguration liegt schon als `extension/.mcp.json` im Repo. Beim ersten
Öffnen mit Claude Code wird gefragt, ob du den Server aktivieren möchtest →
**Ja**.

Falls die Frage nicht erscheint:

```bash
claude mcp list                    # zeigt aktive Server
claude mcp add chrome-devtools     # falls noch nicht da, manuell zufügen
```

Der Server startet automatisch, sobald Claude Code ihn das erste Mal benutzt
(`npx -y chrome-devtools-mcp@latest --isolated --categoryExtensions`).

- `--isolated` — temporäres User-Data-Verzeichnis, automatisch aufgeräumt nach
  Schließen, kein Konflikt mit deinem normalen Chrome-Profil.
- `--categoryExtensions` — schaltet `install_extension`,
  `trigger_extension_action`, `reload_extension`, `uninstall_extension`,
  `list_extensions` frei. Standardmäßig **aus** (laut MCP-Doku). Funktioniert
  bis Chrome 149 nur mit Pipe-Connection (also nicht mit `--browserUrl` /
  `--wsEndpoint` — siehe ["an laufendes Chrome andocken"](#alternative-an-laufendes-chrome-andocken)).

### 3. Extension bauen — **`npm run dev` empfohlen**

```bash
cd extension
npm run dev        # HMR-Build, dist/ bleibt mit Watch-Modus aktuell
# ODER einmalig:
npm run build      # produziert dist/, kein Watch
```

> **Wichtig für Live-Tests via MCP:** Lass `npm run dev` laufen, nicht nur
> einmalig bauen. **Empirie (2026-04-30):** mit reinem Prod-Build aus
> `npm run build` schlossen sich `chrome-extension://`-Pages (Side Panel +
> Extension-Tab) sofort beim CDP-Touch (`select_page`, `take_snapshot`,
> `evaluate_script` → "page has been closed"). Mit laufendem `npm run dev`
> bleiben sie stabil und sind voll inspizierbar. Vermutlich hält der HMR-
> Websocket das Document über den Debugger-Attach hinweg am Leben.

Bei Code-Änderungen mit `npm run dev`: Vite schreibt `dist/` automatisch neu;
in Claude Code dann *"reload chrome-devtools extension"* (`reload_extension`-
Tool) damit Chrome die neue Version greift.

## Use-Cases

### A) Modul-Verhalten auf echten Seiten verifizieren

Beispiel-Prompt:

> Installiere die Extension aus `extension/dist`, öffne https://wwwe.de in einem
> neuen Tab, öffne das Side Panel, starte einen Web-Check, lass mich die
> Headings-Ergebnisse sehen, und gib mir Console-Errors falls welche da sind.

**Standard-Flow** (alle 10 Module inkl. Backend-abhängige):

1. `npm run dev` muss laufen (siehe Setup #3)
2. `install_extension({path: "<absolut>/extension/dist"})`
3. `new_page` zur Ziel-URL → Page A
4. `select_page(A)` → `trigger_extension_action(id)` öffnet das Side Panel als
   eigene Page B (chrome-extension://...)
5. `select_page(B)` (mit Dev-Build stabil; mit Prod-Build closed sich die Page)
6. `take_snapshot(verbose: true)` — Card-Container suchen: **die `StaticText`-
   Einträge sind nicht klickbar**, du brauchst die wrapping `generic`-uid
   (z.B. `4_19` für die "Web Checker"-Karte, nicht `1_7` für den Text)
7. `click(<generic-uid>)` → navigiert in den Web-Checker
8. `click("Start check"-Button)` → wartet auf Audit
9. `wait_for(["error","warning","Fehler","Warnung","OK"])` mit Timeout 30-60s
10. Drill-down in einzelne Module: `click(<modul-card-uid>)`
11. Zurück: `click(<button "Web Checker">)` aus dem Breadcrumb

**Wichtig:** Side-Panel-Page selektieren funktioniert nur mit laufendem
`npm run dev`. Mit reinem Prod-Build → "selected page has been closed".

### B) Performance-Modul gegen Lighthouse vergleichen

Unser eigenes Performance-Modul nutzt PageSpeed Insights über das Backend.
chrome-devtools-mcp hat einen lokalen `lighthouse_audit`. Beispiel-Prompt:

> Audite https://wwwe.de mit Lighthouse für Mobile, dann starte unser
> Performance-Modul auf der gleichen Seite und sag mir, wo die Ergebnisse
> auseinandergehen.

Praktisch, um zu prüfen, ob das Backend andere Werte liefert als ein lokaler
Audit.

### C) DOM-Lookups debuggen (`_meta`-Heuristik)

Wenn ein Modul ein Element nicht findet (Click-to-Highlight tot, Overlay-Badge
fehlt), ist meist die `_meta`-Lookup-Heuristik in `useModuleAttributes.findEl`
schief — sieh dazu auch [composables.md](./composables.md). Beispiel-Prompt:

> Lade https://example.com, lass das Headings-Modul laufen, gib mir die
> resultierenden `data-wwwebar-id`-Attribute aus dem DOM und vergleiche sie
> gegen die `items[].element`-UUIDs aus dem useCheckStore.

`evaluate_script` kann sowohl Page-Kontext als auch (über das DevTools-Panel)
in den Sidebar-Kontext schauen.

### D) Network-Calls inspizieren

Sehen, was das Spellcheck-Modul oder Performance-Modul wirklich an das Backend
schickt:

> Starte einen Web-Check auf https://wwwe.de, fang alle Requests an
> `localhost:3000` ab, zeig mir Headers + Response-Body von dem
> /api/spellcheck Call.

`list_network_requests` + `get_network_request`.

### E) Site-Wide-Check live debuggen

> Öffne wwwe.de, starte den Site-Wide-Check, mach alle 2 Sekunden einen
> Screenshot vom Side Panel, und sag mir, wann der gepinnte Background-Tab
> geöffnet wird.

`take_screenshot` + `list_pages` zeigen, wann der zweite Tab erscheint.

## Wichtige Tools-Übersicht (Auszug)

| Tool | Wofür wir es nutzen |
|---|---|
| `install_extension`, `reload_extension`, `uninstall_extension` | Extension aus `dist/` (un)installieren |
| `trigger_extension_action` | Side Panel öffnen (= Klick aufs Toolbar-Icon) |
| `list_extensions` | prüfen ob Extension wirklich geladen ist |
| `navigate_page`, `new_page`, `list_pages`, `select_page` | Tab-Steuerung |
| `evaluate_script` | beliebigen JS-Code im Page- oder Service-Worker-Kontext laufen lassen |
| `take_snapshot` | strukturierter DOM-Snapshot (für Element-Lookups) |
| `take_screenshot` | visueller Vergleich, Bug-Reports |
| `list_console_messages`, `get_console_message` | Errors/Warnings prüfen |
| `list_network_requests`, `get_network_request` | Backend-Calls inspizieren |
| `lighthouse_audit` | Performance/Best-Practices/A11y-Score |
| `performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight` | tiefe Performance-Analyse |
| `take_memory_snapshot` | Memory-Leak-Hunt |

Vollständige Tool-Liste:
[chrome-devtools-mcp/docs/tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md).

## Häufige Fallstricke

**1. Extension wird installiert, aber Side Panel öffnet nicht.**
Manifest-V3 Side Panel braucht entweder `chrome.sidePanel.open()` mit User-Geste
oder `setPanelBehavior({ openPanelOnActionClick: true })` — letzteres ist im
manifest.json bereits aktiv. Wenn `trigger_extension_action` trotzdem nichts
sichtbar macht: `take_screenshot` kann das Side Panel nicht erfassen, weil es
außerhalb des Tab-Viewports rendert. Prüfe `list_pages` — das Side Panel sollte
als eigene Page mit `chrome-extension://...` URL auftauchen.

**2. `install_extension` schlägt fehl.**
Pfad muss **absolut** sein und auf einen entpackten Ordner mit `manifest.json`
zeigen, also typischerweise `<repo-root>/extension/dist/`. Der Build muss
vorher gelaufen sein (`npm run build`).

**3. Code-Änderungen werden nicht reflektiert.**
`reload_extension` reicht oft nicht — bei Hintergrund-Service-Worker- oder
Manifest-Änderungen `uninstall_extension` + `install_extension` neu.

**4. Mehrere Chrome-Instanzen kollidieren.**
Mit `--isolated` (Default) startet chrome-devtools-mcp eine eigene Instanz mit
temporärem Profil. Dein normales Chrome läuft daneben weiter. Wenn du an deine
laufende Chrome-Instanz andocken willst (mit installierten Erweiterungen,
Logins, …), siehe nächster Abschnitt.

**5. Side Panel / Extension-Page schließt sich beim CDP-Touch.**
Symptom: `select_page(<chrome-extension://...>)` oder `take_snapshot` →
*"selected page has been closed"*. Ursache: Prod-Build aus `npm run build`
ohne laufenden HMR-Watcher. **Fix:** `npm run dev` starten und Extension
reloaden (`reload_extension`). Mit dem HMR-Build bleiben Side-Panel- und
Extension-Tab-Pages stabil für Inspektion. Empirisch verifiziert
2026-04-30 — siehe Setup #3.

**6. Service-Worker-Target-IDs sind instabil.**
`evaluate_script({serviceWorkerId: "sw-N"})` schlägt oft mit *"No target with
given id found"* fehl, weil MV3-SWs nach 30s Idle einschlafen und `sw-N` sich
zwischen `list_pages`-Calls hochzählt. Workaround: SW kurz vorher aufwecken,
z.B. via `chrome.runtime.getBackgroundPage()` oder einer Dummy-Message. Für
Audits dieser Extension nicht nötig — der Side-Panel-Klick-Flow (siehe
Use-Case A) ist zuverlässiger.

**7. StaticText ist nicht klickbar — generischen Container suchen.**
`take_snapshot` (default-mode) zeigt nur die a11y-relevanten Elemente; die
Card-Wrapper als `generic` werden ausgeblendet. `take_snapshot(verbose: true)`
zeigt alle Container; klick auf den `generic`-uid, der den Title+Badge
umschließt — nicht auf die `StaticText`-uid des Titels.

## Alternative: an laufendes Chrome andocken

Statt einer isolierten Instanz an dein normales Chrome andocken — nützlich,
wenn du mit deinem echten User-Profil + installierten Erweiterungen arbeiten
willst.

> **Achtung:** In diesem Modus sind die Extension-Tools (`install_extension`,
> `trigger_extension_action`, …) **nicht verfügbar** (siehe Hinweis bei
> `--categoryExtensions` oben — funktioniert mit `--browserUrl` erst ab Chrome
> 149). Die Extension muss vor dem Andocken manuell als entpackte Erweiterung
> in `chrome://extensions/` geladen sein; Claude steuert dann nur Tabs +
> Inhalte, nicht das Extension-Lifecycle.

Editier `extension/.mcp.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222"
      ]
    }
  }
}
```

Chrome mit Remote-Debugging starten (Windows-Beispiel):

```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%TEMP%\chrome-debug-profile"
```

Eigenes `user-data-dir` verwenden — nicht das normale Profil-Verzeichnis,
sonst meckert Chrome.

## Siehe auch

- [chrome-devtools-mcp Repo](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [composables.md](./composables.md) — was die Sidebar-Composables tun, falls
  du via `evaluate_script` reinschauen willst
- [module-api.md](./module-api.md) — was die Page-Kontext-Helper bereitstellen,
  falls du Checker-Verhalten manuell triggern willst
