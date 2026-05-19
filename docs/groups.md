# Gruppen

Org-level User-Sammlungen ohne Berechtigungen. Konzeptuell orthogonal
zu Rollen:

| Konzept | Trägt | Beispiel |
|---|---|---|
| Permission | atomares Recht | `admin.users.read` |
| Rolle | Bundle von Permissions | „Admin", „Auditor" |
| **Gruppe** | Sammlung von Users, **keine** Permissions | Teams, Abteilungen, Projekt-Crews |
| User | hat 0..N Rollen + 0..N Gruppen | Marc: `[admin]` + `[team-basti, leads]` |

## Wofür Gruppen?

Sichtbarkeits-Filter auf Ressourcen, ohne Pseudo-Rollen anlegen zu
müssen. Aktuell genutzt von:

- **Check-Types** (`group_ids`): Auditor sieht den Type nur, wenn er
  Mitglied einer der Gruppen ist (oder Rolle/User-Listing matcht)

Geplante Einsatzfelder analog: Report-Sichtbarkeit, Dashboard-Scopes,
„Activity nur für meine Gruppe".

## Backend

### Tabellen — Migration `0013_groups.sql`

- `groups` (`id` als kebab-slug Primary Key, `name`, `description`,
  `system` Flag, `created_by`, Timestamps)
- `user_groups` (`user_id` + `group_id` Composite Primary Key,
  `added_by`, `added_at`) — Cascade-Delete bei User- oder Group-Löschung

### Permissions

- `admin.groups.read` — Modul in Admin-Sidebar sichtbar
- `admin.groups.write` — Create / Edit / Delete / Member-Verwaltung

### Routes (admin)

| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | `/`                           | List groups + member counts |
| GET    | `/:id`                        | Single group + member list |
| POST   | `/`                           | Create |
| PATCH  | `/:id`                        | Update name / description |
| DELETE | `/:id`                        | Cascade — protects `system` rows |
| PUT    | `/:id/members`                | Replace entire member set |
| POST   | `/:id/members/:userId`        | Add one member (idempotent) |
| DELETE | `/:id/members/:userId`        | Remove one member |

### Auth-Pipeline

Beim Login (`/api/auth/callback`) und Refresh (`/api/auth/refresh`)
ruft die Pipeline `resolveUserGroups(user.id)` auf und schreibt das
Ergebnis nach `user.appGroups`. Das landet im JWT-Payload und ist
damit überall via `req.user.appGroups` verfügbar.

Wichtig: nach Änderungen an Gruppen-Mitgliedschaften wird die
Aktualisierung erst beim **nächsten Token-Refresh** wirksam (Access-
Tokens leben max. 15 min, Refresh löst eine erneute DB-Abfrage aus).

## Frontend — Admin

- Modul [`src/admin/modules/groups/`](../src/admin/modules/groups/)
- `Index.vue` — Tabelle aller Gruppen mit Member-Count + Create-Modal
- `GroupDetail.vue` — Profil-Form + Member-Picker mit Search-Input,
  bulk-update via `PUT /members`
- Composable: `useAdminGroups()` — CRUD + `setMembers(id, userIds[])`

## Empfehlung

- Erstelle die paar grundlegenden Gruppen einmalig (z.B. pro Team).
- Weise neue Mitarbeiter nach Onboarding der passenden Gruppe zu.
- In Check-Types und (später) anderen Resources nutze Gruppen statt
  einzelner User-Whitelistings, sobald mehr als 2-3 Personen gemeint
  sind — viel weniger Pflege.
