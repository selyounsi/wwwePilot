# Check-Types

Admin-defined audit profiles for the web-checker. A profile bundles:

- **Modul-Auswahl** — welche der 13 Web-Checker-Module beim Klick auf „Prüfen"
  laufen sollen
- **Manuelle Tasks** — eine Checkliste, die der Auditor abhakt + optional
  kommentiert (z.B. „Impressum vorhanden", „DSE aktuell")
- **Rollen-Sichtbarkeit** — wer den Type im Web-Checker auswählen darf

## Warum

Vorher: jeder User hat seine eigene Modul-Toggle-Auswahl. Die Agentur hat
keine Möglichkeit zu sagen „beim Pre-Launch-Check sollen IMMER die
folgenden 8 Module + die folgenden 5 manuellen Checks laufen".

Nachher: Admin definiert „Pre-Launch-Check" einmal, jeder Auditor sieht
denselben Bundle. Status der manuellen Tasks bleibt pro URL erhalten —
beim erneuten Check derselben Seite sind die Häkchen + Kommentare noch
da.

## Feature-Flag

Das ganze System ist hinter `webchecker.check_types` (siehe
`feature-flags`-Admin-Modul). Default: **an**. Wenn das Flag aus ist oder
keine Types existieren, sieht der Web-Checker exakt aus wie vorher —
keine Type-Select-Box, keine Manuelle-Checkliste.

## Backend

### Tabellen — Migration `0010_check_types.sql`

- `check_types` — Profil (`name`, `slug`, `module_ids` jsonb, `role_ids`
  text[], `position`, `enabled`)
- `check_type_tasks` — Tasks pro Type, cascade-delete, mit `position` für
  manuelle Reihenfolge
- `check_task_states` — Status pro `(url, task_id)`, plus `origin`
  denormalisiert für „alle States dieser Domain" Queries.
  `UNIQUE(url, task_id)` macht den Upsert idempotent.

### Routes

**Admin** (`/api/admin/check-types`, `admin.check-types.read|write`)

| Method | Path                       | Notes |
|--------|----------------------------|-------|
| GET    | `/`                        | List all types + task counts |
| GET    | `/:id`                     | Single type + tasks |
| POST   | `/`                        | Create |
| PATCH  | `/:id`                     | Update name / slug / moduleIds / roleIds / enabled |
| DELETE | `/:id`                     | Cascade delete (incl. tasks + states) |
| POST   | `/reorder`                 | Reorder by id list |
| POST   | `/:id/tasks`               | Add task |
| PATCH  | `/tasks/:taskId`           | Edit task |
| DELETE | `/tasks/:taskId`           | Delete task |
| POST   | `/:id/tasks/reorder`       | Reorder tasks |

**User-facing** (`/api/check-types`, `requireAuth` only)

| Method | Path                       | Notes |
|--------|----------------------------|-------|
| GET    | `/`                        | List types **filtered by user roles** |
| GET    | `/:slug`                   | Type + tasks (404 if role-gated and user lacks role) |
| GET    | `/states?url=&typeId=`     | Persisted task-states for a URL |
| PUT    | `/states/:taskId`          | Upsert one task-state (checkbox + comment) |

Role-Gating: leeres `role_ids`-Array = sichtbar für alle. Sonst muss der
User mindestens eine der Rollen tragen. Superadmin sieht immer alles.

## Frontend — Admin

- Modul: [`src/admin/modules/check-types/`](../src/admin/modules/check-types/)
- `Index.vue` — Tabellen-Liste, „Neu"-Modal, Delete-Action
- `CheckTypeDetail.vue` — Profil-Form + Modul-Multi-Select + Rollen-
  Multi-Select + Task-Editor mit Reorder-Pfeilen
- Composable: `useAdminCheckTypes()` — CRUD + Task-CRUD + Reorder

Permissions:

- `admin.check-types.read` — Modul wird in der Admin-Sidebar gerendert
- `admin.check-types.write` — Create/Edit/Delete-Buttons sichtbar

## Frontend — Web-Checker

- Composable: [`useCheckTypes`](../src/services/web-checker/composables/useCheckTypes.js)
  — fetcht verfügbare Types (gefiltert nach Rollen), lädt aktiven Type +
  Tasks, syncronisiert Task-States pro URL.
- Komponente: [`ManualTaskPanel.vue`](../src/services/web-checker/components/ManualTaskPanel.vue)
  — Checkliste mit Kommentar-Drawer pro Task, persistiert via `PUT`
  bei jedem Toggle + Comment-Save.
- Integration: `HomeView.vue` zeigt das Type-Select-Feld **nur** wenn das
  Feature-Flag an ist UND Types verfügbar sind. Type-Wahl überschreibt
  die Modul-Liste — der Run nimmt nur die im Type definierten Module.

### Verhalten

| Zustand | Web-Checker UI |
|---------|----------------|
| Flag aus | Wie vorher — keine Type-Selectbox, jeder Modul-Toggle frei |
| Flag an, keine Types | Wie vorher — Selectbox bleibt versteckt |
| Flag an, Types vorhanden, nichts gewählt | Selectbox zeigt „Voll-Check (alle Module)" als Default. Verhalten wie vorher. |
| Flag an, Type gewählt | Module-Liste zeigt nur Module aus dem Type. „Prüfung starten" läuft nur diese. Task-Panel erscheint mit Checkliste. |

Task-States sind **per URL** persistiert. Wenn der Auditor dieselbe URL
ein zweites Mal prüft, sieht er die vorherigen Häkchen + Kommentare.

## Anlegen eines Types (Beispiel)

1. Admin → Web-Checker → Check-Typen → „Neuer Check-Typ"
2. Name: „Pre-Launch-Check", Slug: `pre-launch-check`
3. Im Detail-View:
   - Module ankreuzen: `accessibility`, `images`, `links`, `overview`,
     `privacy`, `validation`, `structured-data`, `spellcheck`
   - Tasks anlegen:
     - „Impressum auf jeder Seite verlinkt"
     - „Datenschutzerklärung aktuell"
     - „Cookie-Banner DSGVO-konform"
     - „404-Seite vorhanden"
   - Rollen-Gating leer lassen → für alle sichtbar
   - Speichern

Auditor in der Extension: Side-Panel → Web-Checker → „Check-Typ:
Pre-Launch-Check" auswählen → „Prüfung starten". Module laufen, danach
hakt der Auditor die manuellen Tasks ab und schreibt ggf. einen
Kommentar.
