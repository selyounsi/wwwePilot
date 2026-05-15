# Reports

User-submitted bug reports, feature requests and false-positive flags. Lives at
`/admin/reports` and is owned by the `reports` admin module.

## Scopes

| Scope         | Source UI                              | Identification                   |
| ------------- | -------------------------------------- | -------------------------------- |
| `app`         | "Report" route in the side panel       | none (free-form)                 |
| `module`      | "Report" button on the module page     | `module_id`                      |
| `module_item` | Flag/bug button next to module actions | `module_id` + `issue_hash`       |

The `issue_hash` is `sha256(moduleId|type|elementKey|message)` so the same
finding across runs lines up to the same hash (see `useIssueHash.js`).

## Admin features

- **List + filters** at `/admin/reports`: status / category / scope, plus a
  status-counter strip on top.
- **Stats panel** (toggle): category / scope breakdowns, top reporters, avg
  and median resolution time, 14-day inflow sparkline. Hydrated lazily on
  panel open via `GET /api/admin/reports/stats`.
- **Detail view** at `/admin/reports/:id`:
  - Status as a dropdown — a styled `ConfirmDialog` confirms the change
    rather than the browser's `confirm()`.
  - Severity chips (low/medium/high).
  - **Assignment**: dropdown of all users, plus a "Take this" shortcut to
    self-assign. Patches `assigned_to` through the existing PATCH.
  - Resolution note (visible to the reporter).
  - Comments thread (owner OR admin can post).
  - Delete (also `ConfirmDialog`).

## Backend endpoints

| Method | Path                              | Permission              |
| ------ | --------------------------------- | ----------------------- |
| `GET`  | `/api/admin/reports`              | `admin.reports.read`    |
| `GET`  | `/api/admin/reports/counts`       | `admin.reports.read`    |
| `GET`  | `/api/admin/reports/stats`        | `admin.reports.read`    |
| `PATCH`| `/api/admin/reports/:id`          | `admin.reports.write`   |
| `DELETE`| `/api/admin/reports/:id`         | `admin.users.write`     |
| `POST` | `/api/reports`                    | authenticated           |
| `GET`  | `/api/reports/:id`                | owner OR admin.reports.read |
| `POST` | `/api/reports/:id/comments`       | owner OR admin.reports.write |

The list endpoint joins on both `reports.user_id` (reporter) and an aliased
`assignee` (`reports.assigned_to`) so the table can show both names without a
second round-trip.

### Stats query notes

Resolution-time stats are bounded to the 200 most recent resolved reports.
The intent is to keep the query cheap as the table grows; if you ever need
a rolling window instead, swap the `LIMIT` for a date predicate.

## Sidebar badge

`AdminLayout.vue` polls `/api/admin/reports/counts` every 60s and shows
`open + investigating` as a red pill next to the "Reports" nav item. The
poll is cheap (indexed `GROUP BY status`) and silent on errors.
