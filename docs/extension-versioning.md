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
   ein Klick auf „Pfad kopieren" → einfügen in Win+E. Ohne gespeicherten
   Pfad: Mitarbeiter sieht die ZIP eh schon im Explorer (Step 1).
3. **Reload** — `chrome.runtime.reload()` startet die Extension neu.

> Chrome erlaubt keiner Extension sich selbst neu zu installieren — der
> manuelle File-Replace + Reload ist Pflicht für self-hosted Extensions
> ohne Chrome Web Store. Native Messaging wäre die einzige Alternative,
> braucht aber einen lokalen Helper auf jedem Rechner.

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
