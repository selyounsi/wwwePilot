# Admin Spellcheck-Modul

Verwaltet Domain-Wörterbücher, ignorierte Fehler und Komplett-Site-Checks
gegen die wwwe SpellCheck-App API. Liegt unter `/admin/spellcheck`,
sortiert in der Sidebar in der Web-checker-Gruppe.

## Backend

Eingehängt im bestehenden Web-checker-Service:

```
services/webchecker/spellcheck/
  module.json     ← deklariert sowohl /api/spellcheck (user-proxy) als
                    auch /api/admin/spellcheck (admin) als Mount-Punkte
  routes.js       ← bestehender User-Proxy (check-text, dictionary, ignored)
  admin.js        ← neue Admin-Endpoints
  api.js          ← gemeinsamer Client für die SpellCheck-App, damit beide
                    Mounts denselben Token + Pfad benutzen
```

### Endpoints

Alle unter `/api/admin/spellcheck`, gated by Permissions:

| Method | Pfad                                  | Permission                |
| ------ | ------------------------------------- | ------------------------- |
| GET    | `/domains`                            | `admin.spellcheck.read`   |
| GET    | `/domains/:domain/dictionary`         | `admin.spellcheck.read`   |
| POST   | `/domains/:domain/dictionary`         | `admin.spellcheck.write`  |
| DELETE | `/dictionary/:id`                     | `admin.spellcheck.write`  |
| GET    | `/domains/:domain/ignored-errors`     | `admin.spellcheck.read`   |
| POST   | `/domains/:domain/ignored-errors`     | `admin.spellcheck.write`  |
| DELETE | `/ignored-errors/:id`                 | `admin.spellcheck.write`  |
| POST   | `/check-site`                         | `admin.spellcheck.write`  |
| GET    | `/results/:slug`                      | `admin.spellcheck.read`   |

`GET /domains` liest die Origin-Liste aus eurer eigenen `check_runs`
Tabelle (sortiert nach letztem Lauf). Admins können im UI auch beliebige
Domains tippen — die werden direkt an die Spellcheck-App weitergegeben,
auch wenn ihr noch nie was gegen die geprüft habt.

Schreibende Aktionen schreiben in `admin_audit` (action prefix
`spellcheck.*`), damit man im Audit-Log + Activity-Stream sieht wer was
gemacht hat.

## Frontend

```
extension/src/admin/modules/spellcheck/
  module.json        ← nav.group: webchecker, order: 40
  views/Index.vue    ← Drei-Spalter:
                       links Domain-Liste, rechts Domain-Detail mit
                       Site-Check-Button, Wörterbuch + ignorierte Fehler
  composables/useAdminSpellcheck.js
  translations/translations.json
```

Die View teilt sich in eine Domain-Liste (links, aus `check_runs`) plus
ein Detail-Panel (rechts) mit:

1. **Site-Check-Action**: ruft `POST /check-site` → kriegt slug + Dashboard-URL
2. **Wörterbuch-Editor**: Wort hinzufügen (`force` Option für admin-override)
   / entfernen, Liste mit Source + erstellt-Zeit
3. **Ignored-Errors-Editor**: gleicher Style wie Wörterbuch

`force: true` umgeht die LanguageTool-Validierung — gehört nur zur
hand wenn man weiß dass das Wort wirklich richtig ist, sonst kriegt
man "Wort von LanguageTool abgelehnt" zurück.

## Permissions auto-grant

Beim Boot prüft der Seed-Orchestrator welche Permissions neu im Katalog
sind (= existieren noch nicht in der `permissions` Tabelle). Frisch
eingefügte Permissions werden automatisch der `admin` Rolle zugewiesen,
damit Admins nach einem Deploy nicht aus neuen Modul-Endpoints
ausgesperrt sind. Manuell entfernte Permissions bleiben entfernt.
