# Authentifizierung (OIDC)

Wie sich User in der Extension einloggen — kompakt, mit den nötigen Schritten zum Onboarden neuer Umgebungen.

## Was ist OIDC und warum

**OpenID Connect** ist ein Standard für „Login mit zentralem Account". Statt dass jede Anwendung eigene Passwörter speichert, vertraut sie einem Identity Provider (bei uns **EverAuth**). Vorteil: ein Account, ein Login-Erlebnis für alle wwwe-Tools (panel, vault, …).

Die Extension ist ein **OIDC Client** (eine Anwendung, die einen User über EverAuth authentifiziert). Konkret heißt das:

1. User klickt im Side Panel auf „Mit wwwe-Account anmelden"
2. Browser öffnet die EverAuth-Login-Seite
3. EverAuth prüft Credentials (intern via viscomp)
4. EverAuth schickt einen Authorization-Code zurück an unser Backend
5. Backend tauscht den Code gegen einen JWT
6. JWT wandert zur Extension, wird in `chrome.storage.local` gespeichert
7. Alle weiteren API-Calls (Spellcheck, Chatbot) laufen mit dem JWT

## Die EverApps-Tools

| URL | Wofür |
|---|---|
| [panel.everapps.io](https://panel.everapps.io) | Admin-UI für EverAuth — User, Sessions, OIDC-Clients verwalten |
| [auth.everapps.io](https://auth.everapps.io) (prod) | Identity Provider — kennt alle wwwe-User |
| [auth.everapps.dev](https://auth.everapps.dev) (dev) | Dev-Spiegel des Providers, gleiche API |
| [vault.everapps.io](https://vault.everapps.io) | Passwort-Tresor für Client-Secrets, Tokens, etc. |

Beide Auth-Umgebungen laufen parallel: `auth.everapps.dev` ist der Spielplatz, `auth.everapps.io` die Produktion.

## Onboarding für eine neue Anwendung / Umgebung

Wenn du Login für ein neues Tool oder eine neue Umgebung brauchst:

### 1. OIDC-Client bei Kerem anfragen

Schick **Kerem** (IT) folgende Info:

> Bitte einen OIDC-Client für `<App-Name>` bei `auth.everapps.<dev|io>` anlegen.
>
> - **Redirect URI:** `https://<host>/api/auth/callback`
> - **Post-Logout Redirect URI:** `https://<host>/*`
> - **Token Endpoint Auth:** `client_secret_basic`
> - **Scopes:** `openid profile email groups roles permissions`
> - **Grant Type:** Authorization Code mit PKCE

Beispiel:
- Dev: `https://<subdomain>.everapps.dev/api/auth/callback`
- Prod: `https://<subdomain>.everapps.io/api/auth/callback`

### 2. Vault-Zugang einrichten

Du brauchst einen Account auf [vault.everapps.io](https://vault.everapps.io). Dann **Kerem** Bescheid geben:

> Bitte schalte mich frei für die Vault-Sammlung **„EverAuth OIDC"**.

In der Sammlung gibt es zwei Ordner — einen pro Umgebung:

```
EverAuth OIDC/
├── auth.everapps.dev/
│   └── <App-Name>/     ← Client ID + Secret + Issuer-URL
└── auth.everapps.io/
    └── <App-Name>/     ← Client ID + Secret + Issuer-URL
```

Sobald Kerem den Client angelegt hat, taucht der Eintrag dort auf. Drei Werte rauskopieren:

- `OIDC_ISSUER_URL` — z.B. `https://auth.everapps.dev`
- `OIDC_CLIENT_ID` — UUIDv4 vom Provider
- `OIDC_CLIENT_SECRET` — generiertes Secret

### 3. Werte in die Server-`.env` eintragen

Auf dem Server (typischerweise `/var/dimages/<projekt-ordner>/backend/.env`):

```env
OIDC_ISSUER_URL=https://auth.everapps.dev
OIDC_CLIENT_ID=…
OIDC_CLIENT_SECRET=…
PUBLIC_BASE_URL=https://<subdomain>.<domain>
```

`PUBLIC_BASE_URL` muss zur Hosting-URL passen, damit Backend die Callback-URLs korrekt gegen den Provider sendet.

### 4. Container neu starten

```bash
cd /var/dimages/<projekt-ordner>/backend
bash _scripts/deploy.sh
```

Verifizieren:
```bash
curl https://<subdomain>.<domain>/api/auth/config
# → {"oidcConfigured":true, ...}
```

## Stub-Modus für lokale Entwicklung

Wenn `OIDC_ISSUER_URL` leer ist, schaltet das Backend in einen **Stub-Modus**:

- `/api/auth/login` redirected sofort zum Callback mit Fake-Code
- Backend gibt einen Fake-User-JWT zurück (`stub@wwwe.de`)
- Kein Provider, kein Browser-Login

Praktisch für lokales Frontend-Testing ohne IT-Aufwand. In Produktion **immer** echte Werte setzen, sonst kann sich jeder als beliebiger User einloggen.

## Login-Flow (technisch)

```
Extension (Side Panel)
  │
  │ 1. Klick auf "Mit wwwe-Account anmelden"
  │    chrome.identity.launchWebAuthFlow(authUrl)
  ▼
Backend  GET /api/auth/login?ext_redirect=…
  │
  │ 2. Pre-Logout (zerstört alte Provider-Session)
  ▼
Provider GET /oidc/logout
  │
  │ 3. Redirect zurück
  ▼
Backend  GET /auth-bridge?state=…
  │
  │ 4. Authorize-Redirect
  ▼
Provider GET /oidc/authorize  → User loggt sich ein
  │
  │ 5. Redirect mit Authorization-Code
  ▼
Backend  GET /api/auth/callback?code=…
  │
  │ 6. Token-Exchange (HTTP Basic Auth)
  │    /oidc/token + /oidc/userinfo
  │
  │ 7. App-JWT signieren, Redirect zur chromiumapp-URL
  ▼
Extension  fängt Tokens via launchWebAuthFlow ab,
           speichert in chrome.storage.local (`wp-auth`)
```

Die App-JWTs (Access + Refresh) sind **eigene** Tokens des Backends, nicht die vom Provider. So bleibt die Extension unabhängig von der Provider-Session — Refresh läuft komplett über das Backend, ohne den User nochmal an EverAuth zu schicken.

## EverAuth-spezifische Quirks

Drei Eigenheiten die der Login-Code im Backend kompensieren muss:

1. **Pre-Logout vor Authorize**
   `/oidc/authorize` wirft `INTERNAL_SERVER_ERROR` wenn der Browser noch eine alte Provider-Session hat. Wir routen jeden Login deshalb erst durch `/oidc/logout` und dann erst zu `/authorize`. Das macht jede Session frisch.

2. **`postLogoutRedirectUris`-Wildcard matcht nur 1 Pfad-Segment**
   `https://<subdomain>.<domain>/*` akzeptiert `/anything`, aber **nicht** `/api/auth/logout/callback` (4 Segmente). Deshalb gibt's eine Top-Level-Route `/auth-bridge`, die zum Pre-Logout-Handler gemounted ist.

3. **`client_secret_basic` ohne URL-Encode**
   EverAuth akzeptiert raw `Buffer.from(id:secret).toString('base64')`, lehnt aber den von RFC 6749 verlangten URL-encoded Variant ab (den `openid-client` standardmäßig sendet). Wir injizieren deshalb eine Custom-Auth-Funktion, siehe [oidcClient.js](../../backend/_apps/backend/src/auth/oidcClient.js).

Wenn EverAuth diese drei Quirks irgendwann fixt, können entsprechende Workarounds raus.

## Wo welcher Code

| Datei | Zweck |
|---|---|
| [src/composables/auth/useAuth.js](../src/composables/auth/useAuth.js) | Reactive User-State, login()/logout()/refresh(), persistiert in `chrome.storage.local` unter `wp-auth` |
| [src/composables/auth/apiClient.js](../src/composables/auth/apiClient.js) | `apiFetch`-Wrapper: hängt Bearer-Header dran, retry mit Refresh bei 401 |
| [src/views/LoginView.vue](../src/views/LoginView.vue) | Login-Maske mit dem „Mit wwwe-Account anmelden"-Button |
| [src/router/index.js](../src/router/index.js) | `beforeEach`-Guard: alle Routes außer `/login` brauchen `isAuthenticated` |
| Backend `routes/auth.js` | Pre-Logout, Callback, Token-Exchange, App-JWT-Signing |
| Backend `auth/oidcClient.js` | Discovery + Custom Basic Auth |

Backend-Doku separat: [backend/README.md](../../backend/README.md) — Routen-Übersicht, ENV-Vars, Onboarding-Schritte.
