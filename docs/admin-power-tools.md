# Admin Power-Tools

Vier neue Quality-of-Life-Features im Admin-Backend.

## Cmd+K Quick-Switcher

Globaler `⌘K` / `Ctrl+K` Shortcut öffnet ein zentriertes Such-Modal das über
vier Entity-Typen sucht: Users (Email/Name), Reports (Titel oder ID), Sites
(Origin), Check-Runs (ID).

- Backend: `GET /api/admin/search?q=…` — ILIKE pro Entity, je 5 Treffer pro
  Kategorie (`MIN_Q=2`, `PER_CAT=5` in `modules/search/admin.js`).
- Composable: `useAdminSearch()` mit Inflight-Tracking gegen Race-Conditions
  bei schneller Eingabe.
- UI: `AdminQuickSwitcher.vue` — Pfeiltasten + Enter zum Navigieren, Esc
  zum Schließen, Click-Outside schließt. Globaler `defineExpose({ open })`
  lässt den Sidebar-Such-Button das Modal öffnen.

Die Sidebar zeigt einen "Suchen… ⌘K" Button als Discoverability-Affordance —
sonst wüsste niemand dass es den Shortcut gibt.

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
