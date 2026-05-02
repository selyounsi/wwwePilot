# Privacy-Modul

Prüft ob Cookie-/Tracking-Elemente (iframes, Scripts, Bilder) **maskiert**
sind — d.h. nicht ohne User-Consent geladen werden. wwwe-CMS-Seiten
implementieren das via [privacyControl](../../../../). Modul-Resultate
respektieren bereits gegebene Consents (Maps schon akzeptiert ⇒ legitim).

## Was als Tracking-Element gilt

**Jedes cross-origin `<iframe>`, `<script>` oder `<img>`** wird geprüft —
nicht nur eine fixe Whitelist. Same-Origin-Elemente werden ignoriert (die
sind privacyControl-irrelevant). Inline-Scripts ohne `src` und Elemente
ohne URL werden übersprungen.

`IGNORED_HOST_PATTERNS` (in `index.js`) blendet wwwe-eigene Drittanbieter-
Hosts wie `meinebewertungen` aus.

Items bekommen einen Type-Prefix im Title: `[IFRAME]`, `[SCRIPT]` oder
`[IMG]`. Scripts werden im UI nicht halbtransparent dargestellt (override
auf `visible: true`), weil sie als DOM-Elemente per Definition nie sichtbar
sind und das `mdiEyeOff`-Icon irreführend wäre.

### Service-Name-Auflösung

Pro Element wird der `service`-Key in dieser Reihenfolge bestimmt:

1. **Aus `data-iframe`/`data-script`/`data-img`-Attribut** — der Service-Key
   den privacyControl auf dem Element hinterlegt hat
2. **Aus `HOST_TO_SERVICE`** — Mapping bekannter Hosts auf privacyControl-
   Keys (für Elemente die nicht via privacyControl markiert sind):

   | Service | Pattern |
   |---|---|
   | `googlemaps` | `*.google.com/maps/` |
   | `youtube`    | `*.youtube.com`, `*.youtube-nocookie.com`, `youtu.be` |
   | `autoscout`  | `autoscout24.{de,com,at,ch}` |
   | `mobilede`   | `mobile.de` |
   | `immoscout`  | `immobilienscout24.de` |
   | `curator`    | `curator.io` |
   | `gtag_gtm`   | `googletagmanager.com/gtm.js` |
   | `gtag_g`     | `googletagmanager.com/gtag/js`, `google-analytics.com` |
   | `gtag_aw`    | `googleadservices.com`, `googlesyndication.com`, `doubleclick.net` |

Cross-origin Elemente von **unbekannten Hosts** werden trotzdem erfasst —
Service-Name wird `null` (UI: "unknown"). Wenn nicht maskiert + kein
Consent ⇒ Error.

### Service-Display-Name + Provider

Der Modul liest direkt `window.pCServiceTemplates` — diese globale Variable
wird von allen privacyControl-Varianten gesetzt:

| Variante | Config-Pfad | Globale |
|---|---|---|
| v3 (aktuell) | `/securewebapps/evercdn/assets/privacyControl/v3/scripts/config.min.js` | `window.privacyControl` |
| v2 | `/privacyControl-2.0.conf.js` | `window.privacyControl` |
| v2-standalone (sehr alt) | `/_modules/privacyControl/privacyControl-2.0-standalone.js` | `window.PrivacyControl` (groß-P) |

Vor jedem Audit werden die Page-Main-World-Globals ins Isolated-World
propagiert (siehe [module-api.md](../../../../../docs/module-api.md#page-globals-direkt-auf-window)).
Module fragen `window.privacyControl ?? window.PrivacyControl` ab, damit
auch alte Projekte funktionieren.

Aus dem Template wird gezogen:
- `tpl.name` → angezeigt im Item-Title (z.B. "Google Maps" statt "googlemaps")
- `tpl.provider` → angezeigt im Item-Detail (z.B. "Google Ireland Limited")
- `tpl.type` → Validation: wenn `data-iframe="curator"` aber Template sagt
  `type: "script"`, wird ein Type-Mismatch-Warning generiert

### Konfigurations-Validation

Wenn ein Element ein `data-iframe`/`data-script`/`data-img`-Attribut hat,
der Service-Key aber **nicht in `pCServiceTemplates`** existiert ⇒ Warning
("Unknown service '...' — not in pCServiceTemplates"). Hilft beim Aufspüren
von Tippfehlern oder fehlenden Service-Definitionen.

## Was als "maskiert" gilt

| Element | Maskiert wenn |
|---|---|
| `<iframe>` | hat `data-iframe`, `data-src`, oder `src` zeigt auf privacyControl-Placeholder |
| `<script>` | hat `data-script`, `data-src`, oder `type` ist nicht js (z.B. `text/plain`) |
| `<img>` | hat `data-img`, `data-src`, oder `src` zeigt auf Placeholder |

Placeholder-Pattern matcht beide CMS-Konventionen:
- CMS4: `/securewebapps/.../privacyControl/v3/placeholder/index.html?key=…`
- CMS3: `/privacyControl-2.0.placeholder.html?key=…`

## Logik

Pro gefundenem Tracking-Element:

1. Element ist maskiert (= durch privacyControl gegated) ⇒ ✅ **Success**
   - Mit Consent: "Loaded after consent for {service}"
   - Ohne Consent: "Properly masked, waiting for consent"
2. Element nicht maskiert ⇒ 🔴 **Error**, **unabhängig vom Consent-Status**

**Wichtig:** Consent-Status spielt nur eine Rolle für die Beschreibung
maskierter Elemente. Ein unmaskiertes Element bleibt **immer** ein Fehler —
auch wenn der User dem Service zugestimmt hat. Begründung: ein direkt
geladenes Tracking-Element setzt seine Cookies bei **jedem** Page-Visit,
bevor der User überhaupt Consent geben konnte. Nachträgliche Zustimmung
heilt das nicht.

Aggregat-Warning oben drüber wenn unmaskierte Elemente da sind UND
`window.cms.hasPrivacyControl === false` (privacyControl global gar nicht
installiert).

## Consent-Erkennung

Aus `window.consent` (Snapshot von `window.privacyControl.get('all')` zur
Audit-Zeit). Per-Service-Lookup: `window.consent?.[serviceName] === true`.

Service-Mapping kommt zuerst aus `data-iframe="…"` / `data-script="…"` /
`data-img="…"`-Attribut, falls nicht da via Host-Pattern.

## CMS-Versions-Erkennung

Modul nutzt `window.cms.hasPrivacyControl` als Hint — der globalen Variable
heißt aber zwischen CMS3 und CMS4 unterschiedlich. Daher: pro Element wird
zuerst auf Maskierung geprüft (DOM-Heuristik), nicht auf globaler PC-Existenz.
So funktioniert das Modul auf alten CMS3-Seiten auch ohne `window.privacyControl`.

## Einschränkungen

- Inline-Scripts mit Tracking-Calls (`gtag(...)`, `fbq(...)`, `_paq.push(...)`)
  werden aktuell **nicht** geprüft — nur Elemente mit `src`/`data-src`.
- Tracking-Pixel via CSS `background-image` werden nicht erkannt.
- Service-Worker-Caches und Browser-Storage von Drittanbietern werden nicht
  geprüft — nur DOM-Elemente.
