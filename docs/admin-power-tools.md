# Admin Power-Tools

Vier neue Quality-of-Life-Features im Admin-Backend.

## Cmd+K Quick-Switcher

Globaler `⌘K` / `Ctrl+K` Shortcut öffnet ein zentriertes Such-Modal das über
fünf Kategorien sucht: **Pages** (Admin-Nav-Einträge inkl. Sub-Items in
Gruppen), Users (Email/Name), Reports (Titel oder ID), Sites (Origin),
Check-Runs (ID).

- **Pages** (lokal, instant): `useAdminSearch.js` baut beim Modul-Laden einen
  Index aus `adminNav` + `adminNavGroups`. Match gegen Label, Key, Group,
  Group-Label, Path und Permission-Slug. Keine Round-Trip — funktioniert
  auch offline.
- **Backend-Entities**: `GET /api/admin/search?q=…` — ILIKE pro Entity, je 5
  Treffer pro Kategorie (`MIN_Q=2`, `PER_CAT=5` in
  `services/search/admin.js`).
- Composable: `useAdminSearch()` mit Inflight-Tracking gegen Race-Conditions
  bei schneller Eingabe.
- UI: `AdminQuickSwitcher.vue` — Pfeiltasten + Enter zum Navigieren, Esc
  zum Schließen, Click-Outside schließt. Globaler `defineExpose({ open })`
  lässt den Sidebar-Such-Button das Modal öffnen.

### Permission-Filterung (automatisch)

Suche zeigt nur Ergebnisse für die der User Zugriff hat — beidseitig
gegated:

- **Frontend (Pages)**: `searchPages()` ruft die `has(slug)`-Callback aus
  `usePermissions()` für jeden Treffer. Items ohne `permission`-Feld
  durchlaufen unverändert (z.B. Dashboard ohne explizite Berechtigung).
- **Backend (Entities)**: `services/search/admin.js` prüft pro Kategorie
  mit `hasPermission(req.user, slug)`:
  - `users` → `admin.users.read`
  - `reports` → `admin.reports.read`
  - `sites` + `runs` → `admin.activity.read`

  Fehlt die Permission, wird die SQL-Query für diese Kategorie
  übersprungen und ein leeres Array zurückgegeben. Verhindert Information
  Leakage über die bloße Existenz von Entities.

## CSV-Export

Generisches `useTableExport()` Composable: `exportCSV({ rows, columns, filename })`
oder `exportJSON({ rows, filename })`. Pure-Client — kein Backend nötig,
exportiert exakt was die Tabelle gerade anzeigt (nach Filter).

Eingebaut in: Users, Reports, Runs, Audit. UTF-8 mit BOM damit Excel
deutsche Umlaute richtig anzeigt.

Spalten:
```js
exportCSV({
  rows: [...],
  columns: [
    'email',                                       // plain string
    { key: 'roles', label: 'Roles',
      get: u => (u.roles ?? []).join('|') },       // computed
  ],
  filename: `users-${date}.csv`,
})
```

## Notifications-Glocke

Glocken-Icon im Sidebar-Header (neben dem Version-Tag) mit roter Badge wenn
ungelesene Events da sind. Klick öffnet ein Dropdown mit den letzten 20
Events.

- Backend: `GET /api/admin/dashboard/timeline?since=…&limit=…` — vereinigt
  drei Quellen in einen Stream:
  - Reports (`reports.created_at`)
  - Admin-Aktionen (`admin_audit`)
  - Logins (`activity_events` mit `auth.login.*`)
  Default-Fenster: 7 Tage zurück. Jedes Item kriegt einen stabilen `kind`
  String den das Frontend auf Icon + i18n-Key mappt.
- Composable: `useAdminTimeline()` — pollt alle 60s, persistiert
  `lastReadAt` in `localStorage` pro Browser/Admin-Tab.
- Renderer: `composables/timelineFormat.js#describeItem(item, t)` —
  einheitliche Mapping-Funktion für Bell + Activity-Stream.

Unread-State ist client-only — kein DB-Tracking. Reicht für ein Admin-Tool
mit überschaubarer User-Zahl. Wenn mehrere Admins parallel arbeiten
sehen sie unterschiedliche Counts; das ist OK.

## Activity-Stream auf dem Dashboard

`AdminActivityStream.vue` rendert die gleichen Items wie die Glocke nur in
einer paginierten Timeline-Liste. Mounted im Dashboard zwischen den
Sites-Charts und Top-Usern. Teilt sich die Daten mit der Bell via
`useAdminTimeline()` — kein redundanter Round-Trip beim Dashboard-Open
wenn die Bell die Daten schon gezogen hat.

## Erweitern

Neuen Event-Typ in den Stream einbauen:

1. Backend `modules/dashboard/admin.js` — entweder das `recordAudit`
   automatisch (alle Admin-Actions landen schon im Feed) oder eine extra
   SQL-Quelle in der Timeline-Promise hinzufügen.
2. Frontend `composables/timelineFormat.js` — Case im `describeItem`
   Switch hinzufügen mit Icon + Farbe + Translation-Key.
3. Translation-Key in `admin/translations.json` ergänzen.

Unbekannte Kinds fallen auf einen generischen `{user} · {action}` Output
zurück — damit man neue Events wenigstens sieht bevor man sie sauber
übersetzt.
