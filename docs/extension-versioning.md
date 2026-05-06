# Extension-Versionierung

Die Extension prüft beim Start gegen das Backend, ob eine neuere Version
existiert. Falls ja, blendet sich oben rechts auf dem AppHeader-Avatar ein
roter Punkt ein, und in den Settings unter „Über" gibt's einen
Download-Button.

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

1. Klick auf „Update herunterladen" in den Settings
2. `chrome.tabs.create({ url: state.downloadUrl })` → ZIP-Download startet
3. User entpackt das ZIP
4. `chrome://extensions/` → „Entpackte Erweiterung laden" oder Reload-Knopf
   auf der bestehenden Extension

> Chrome erlaubt keiner Extension sich selbst zu installieren — der manuelle
> Reload ist Pflicht für self-hosted Extensions ohne Chrome Web Store.

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
