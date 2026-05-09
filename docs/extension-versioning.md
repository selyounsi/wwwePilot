# Extension-Versionierung

Die Extension prüft gegen das Backend, ob eine neuere Version existiert —
sowohl im Vordergrund (Sidebar offen) als auch im Hintergrund (Service
Worker via `chrome.alarms`). Bei einem neuen Release blendet sich ein roter
Punkt im QuickNav ein **und** der Mitarbeiter sieht eine native
Desktop-Notification (Klick öffnet die Sidebar direkt im Updates-View).

## Wo die Version herkommt

| Quelle | Wert |
|---|---|
| `chrome.runtime.getManifest().version` | Aktuell installierte Version |
| `GET /api/version` (Backend) | Latest verfügbare Version + Download-URL |

`compareVersions()` macht Standard semver-ish Vergleich (Major.Minor.Patch,
keine Prereleases).

## Composable

```js
import { useExtensionVersion } from '@/composables/useExtensionVersion.js'

const { state, hasUpdate, refresh } = useExtensionVersion()
// state.current     — installed version
// state.latest      — latest from backend
// state.downloadUrl — backend download URL
// hasUpdate         — computed: latest > current
```

`whenExtensionVersionReady()` wird in [main.js](../src/main.js) abgewartet —
setzt einen `watch` auf den Auth-Token, der bei jedem Login einen Refresh
triggert.

## Update-Flow

Drei sichtbare Steps in [UpdatesView.vue](../src/views/UpdatesView.vue):

1. **Download** — `chrome.downloads.download()` mit Bearer-Token. Sobald
   Chrome via `downloads.onChanged` `state=complete` meldet, triggert die
   Extension automatisch `chrome.downloads.show(id)` → der native
   Windows-Explorer öffnet sich mit der ZIP markiert. Spart einen Klick.
2. **Replace files** — Mitarbeiter entpackt ZIP, kopiert Files in den
   Extension-Ordner. Wenn der Pfad einmalig gespeichert wurde
   ([useExtensionPath.js](../src/composables/useExtensionPath.js)), reicht
   ein Klick auf „Pfad kopieren" → einfügen in Win+R. Ohne gespeicherten
   Pfad: Mitarbeiter sieht die ZIP eh schon im Explorer (Step 1).
3. **Reload** — `chrome.runtime.reload()` startet die Extension neu.

> Chrome erlaubt keiner Extension sich selbst neu zu installieren — der
> manuelle File-Replace + Reload ist Pflicht für self-hosted Extensions
> ohne Chrome Web Store. Native Messaging wäre die einzige Alternative,
> braucht aber einen lokalen Helper auf jedem Rechner.

### Optional: Auto-Update-Script (`update.bat` / `update.sh`)

Im Build-Output liegen zwei Scripts, die der Vite-Plugin
`emit-update-script` ([vite.config.js](../vite.config.js)) aus
[build-assets/](../build-assets/) generiert — die Backend-URL wird zur
Build-Zeit eingebaut, das `.sh` bekommt zusätzlich `chmod +x`:

| Plattform | Script | Aufruf |
|---|---|---|
| Windows | `update.bat` | Win+R → Pfad einfügen → Enter |
| macOS / Linux | `update.sh` | Terminal → `bash "<pfad>/update.sh"` einfügen → Enter |

Die Extension erkennt das OS via `chrome.runtime.getPlatformInfo()` und
zeigt den passenden Button an — Mac/Linux-User sehen „update.sh-Befehl
kopieren", Windows-User „update.bat-Pfad kopieren".

Flow:

1. Klick auf den passenden Button (Auto-Update-Karte → Step 1)
2. Einfügen + Enter
3. Terminal/Cmd:
   - prüft Sicherheits-Schranken (siehe unten)
   - holt `latest` via `curl` + JSON-Parsing
   - lädt `<version>.zip` via `curl`
   - löscht alle alten Files (außer sich selbst + ZIP)
   - entpackt (`tar -xf` auf Windows, `unzip` auf Mac/Linux — beide
     OS-built-in)
4. Mitarbeiter klickt anschließend in `chrome://extensions/` auf Reload

Spart das manuelle Entpacken + Reinkopieren. Weiterhin manuell ist nur der
Reload — Chrome triggert für Unpacked-Extensions keinen Auto-Reload.

Sicherheits-Schranken (Abbruch ohne Änderung):

- **manifest.json muss existieren** im Bat-Ordner — verhindert, dass das
  Script bei versehentlichem Ausführen außerhalb des Extension-Ordners
  beliebige Dateien löscht.
- **BACKEND_URL muss `https://`** beginnen — ein versehentlich nicht
  ersetzter `__BACKEND_URL__`-Platzhalter (z.B. wenn jemand die Source-
  Version statt der gebauten kopiert) bricht den Lauf ab.
- **Heruntergeladene ZIP muss `manifest.json` enthalten** (`tar -tf` Check)
  — schützt vor dem Fall, dass das Backend einen Müll-Response liefert
  und das Script anschließend alle alten Files löscht.

Caveats:
- Anti-Virus könnte das Script flaggen — bei Erstausführung evtl.
  SmartScreen-Warnung.
- Falls Chrome Files locked hält, kann `del` fehlschlagen — Mitarbeiter
  muss dann manuell die Side Panel schließen und nochmal starten.

## Hintergrund-Notification

[src/background/versionCheck.js](../src/background/versionCheck.js) wird in
`background.js` einmalig via `registerVersionCheck()` aktiviert:

- Stündlicher Alarm via `chrome.alarms` (`periodInMinutes: 60`)
- Plus Sofort-Check bei Service-Worker-Boot, `onStartup` und `onInstalled`
- Pollt das **unauthentifizierte** `GET /api/version` (kein Token nötig —
  liefert nur die Version, keine sensiblen Daten)
- Bei `latest > installed`: `chrome.notifications.create()` mit
  Dedup-Check via `chrome.storage.local` (jede Version wird nur einmal
  gemeldet)
- Klick auf die Notification → `chrome.sidePanel.open({ windowId })`

## Backend-Vertrag

```jsonc
GET /api/version
{
  "latest":      "1.2.3",
  "sha":         "abc123…",
  "releasedAt":  "2026-05-06T10:25:41.000Z",
  "downloadUrl": "/api/version/download/1.2.3"
}

GET /api/version/releases    // history
GET /api/version/download/:version  // streams the ZIP
POST /api/version/build      // manual rebuild (auth required)
```

Volle Backend-Doku: siehe `backend/_apps/backend/README.md` oder die
Webhook-Setup-Anleitung.
