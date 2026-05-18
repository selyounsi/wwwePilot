# DataTable + Cell-Components

Zentrale Tabellen-Komponente für das Admin-Backend. Statt jede Tabelle
manuell mit `<table>`, Header, `<tbody>`, Loading/Empty/Error-Branches und
duplizierten Farb-Maps zu bauen, definiert man nur:

- `columns: [{ key, label, minWidth, align?, truncate?, titleFrom? }]`
- `rows`
- Optional Slots für Custom-Cells

`DataTable` rendert dann konsistent, ist horizontal scrollbar wenn das
Viewport zu schmal wird (`minWidth`-Prop auf der Tabelle reserviert eine
Mindestbreite — die Wrapper-Sektion scrollt, nicht die ganze Seite), zeigt
Loading-Spinner, Error-Badge und Empty-Zustand zentral und supportet
`hasMore` für Pagination.

Alle Komponenten sind global registriert via Auto-Glob in
`src/components/ui/index.js`. Kein Import nötig.

## Files

```
src/components/ui/data/
  DataTable.vue
  CellBadge.vue
  CellTimestamp.vue
  CellUser.vue
  CellOrigin.vue
  CellCode.vue
  CellTruncate.vue
  CellNumber.vue
```

## DataTable

### Props

| Prop          | Type                | Required | Notes |
|---------------|---------------------|----------|-------|
| `rows`        | `Array`             | yes      | Datenreihen. |
| `columns`     | `Array`             | yes      | Spalten-Definitionen, siehe unten. |
| `loading`     | `Boolean`           | no       | Zeigt Spinner solange `rows.length === 0`. |
| `error`       | `String \| Object`  | no       | Zeigt Error-Box mit Icon. Objekt → `.message`. |
| `rowKey`      | `String \| Function`| no       | Default: `'id'`. |
| `onRowClick`  | `Function`          | no       | Macht Reihen klickbar (Cursor + Hover). |
| `emptyText`   | `String`            | no       | Default: `'Nothing here yet.'`. |
| `dense`       | `Boolean`           | no       | Kleinere Paddings für Sub-Tabellen in Detail-Pages. |
| `hasMore`     | `Boolean`           | no       | Zeigt „Load more"-Button unter der Tabelle. |
| `loadingMore` | `Boolean`           | no       | Spinner statt Chevron im Load-More-Button. |
| `minWidth`    | `String \| Number`  | no       | Erzwingt horizontal scroll wenn Viewport schmaler — z.B. `'900px'`. |

### Events

- `@row-click` — emittiert pro Klick auf eine Reihe (zusätzlich zu `onRowClick`).
- `@load-more` — wenn `hasMore=true` und User klickt „Load more".

### Column-Definition

```js
{
  key:        'status',           // Required — wählt Cell-Slot (`#cell-status`)
                                  //            und liest `row.status` als value
  label:      'Status',           // i18n-Key — wird durch t() gejagt
  align:      'right',            // 'left' (default) | 'right' | 'center'
  width:      '120px',            // Optional fixe Breite
  minWidth:   100,                // Optional Mindestbreite (number → px)
  maxWidth:   '200px',            // Optional Maximalbreite
  truncate:   true,               // Single-line Truncate + auto Tooltip aus value
  titleFrom:  row => row.title,   // Custom Tooltip wenn truncate=true
  cellClass:  'font-mono',        // CSS-Klasse für jede Zelle dieser Spalte
  headerClass: 'bg-primary/5',    // CSS-Klasse für den Header
  cell:       (row, value) => …,  // Inline Render-Function (kein Slot nötig)
  get:        row => row.foo.bar, // Dotted-path alt: bei nested data
  fallback:   '—',                // Render-Fallback bei null/undefined
}
```

### Slots

- `#toolbar` — Filter-Widgets über dem Tabellenkopf.
- `#empty` — überschreibt das Default-Empty-Layout.
- `#cell-<key>` — pro Spalte Custom-Cell-Renderer (`{ row, value, col }`).
- `#row-actions` — Right-aligned Actions-Spalte, click.stop ist
  automatisch — die Row-Click-Navigation wird also nicht getriggert.

## Cell-Components

### `<CellBadge>` — single source of truth für jeden Pill/Badge

Alle Status/Severity/Scope/Category/Kind/Role-Farb-Maps leben in
**einer** Datei: [src/components/ui/data/CellBadge.vue](../src/components/ui/data/CellBadge.vue).
Neue Variante hinzufügen = ein Eintrag in der entsprechenden Map.

```vue
<CellBadge variant="status"   :value="row.status" />
<CellBadge variant="severity" :value="row.severity" />
<CellBadge variant="scope"    :value="row.scope" :icon="scopeIcon(row.scope)" :label="scopeLabel(row.scope)" />
<CellBadge variant="custom"   :value="row.kind" class-name="bg-primary/15 text-primary" />
```

`value` ist der DB-Enum-Wert (z.B. `"resolved"`). i18n übernimmt das
Mapping zum sichtbaren Text. `label` überschreibt das (nützlich bei
custom-Strings wie „Site-wide" / „Single").

Verfügbare `variant`s: `status`, `severity`, `category`, `scope`, `kind`,
`role`, `neutral`.

### `<CellTimestamp>`

```vue
<CellTimestamp :value="row.createdAt" mode="relative" />  <!-- "5 min ago" -->
<CellTimestamp :value="row.createdAt" mode="absolute" />  <!-- "15.5.2026, 08:45:00" -->
<CellTimestamp :value="row.createdAt" mode="both" />      <!-- absolute, tooltip = relative -->
<CellTimestamp :value="row.createdAt" mode="date" />      <!-- "15.5.2026" -->
```

### `<CellUser>`

Render einer User-Repräsentation aus einer DB-Row, mit camelCase ODER
snake_case-Keys. `prefix` lässt zwei Users (z.B. reporter + assignee)
aus einer einzigen Row leben.

```vue
<CellUser :user="row" />                            <!-- name → email → id.slice(8) -->
<CellUser :user="row" show-avatar show-email />     <!-- volle Darstellung -->
<CellUser :user="row" prefix="assignee"
          :empty-label="t('Unassigned')" />         <!-- liest assignee_first_name etc. -->
```

### `<CellOrigin>`, `<CellCode>`, `<CellTruncate>`, `<CellNumber>`

Selbsterklärend — siehe die Files. `<CellNumber>` hat conditional
Coloring per String-Predicate:

```vue
<CellNumber :value="row.errors"   error-when="> 0" />
<CellNumber :value="row.warnings" alert-when=">= 5" muted-when="== 0" />
```

## Responsive Verhalten

Das Layout-Problem aus dem ursprünglichen Reports-Tabellen-Screenshot
löst die `min-width` + `overflow-x-auto`-Kombo:

- Die Tabelle bekommt `min-width: 900px` (oder was du brauchst).
- Der Wrapper hat `overflow-x-auto`.
- Auf schmalen Viewports scrollt **nur die Tabelle** horizontal — die
  Sidebar bleibt fix, der Page-Body scrollt nicht.

Pro Spalte kannst du `minWidth: 150` setzen damit der Inhalt nicht
zusammengedrückt wird (z.B. lange Titel).

## Migration alter Tabellen

Vor der Refaktorierung dupliziert jede der 12 Tabellen-Views:

- `statusColor()` / `severityColor()` / `scopeColor()` mit identischen
  Farb-Maps
- `relative()` (9 Tabellen mit identischem Code)
- `shortHost()` / `userLabel()` (jeweils 6 Mal)
- Loading/Empty/Error-Branches mit leichten Abweichungen
- Tabellen-Markup mit unterschiedlichen Paddings, Aligns, Class-Listen

Nach der Refaktorierung sind alle Tabellen unter `src/admin/modules/*/views/`
auf `<DataTable>` + Cell-Components umgestellt. Eine Design-Änderung am
Badge-Farbschema oder am Tabellen-Padding ist jetzt eine Single-File-Edit.

## Erweiterungen (TODO bei Bedarf)

Aktuell nicht implementiert — wenn benötigt, hier ergänzen:

- **Spalten-Sortierung**: `columns[].sortable = true` + `defaultSort` Prop.
- **Bulk-Select**: `:selectable="true"` + `v-model:selected`.
- **Expandable Rows**: `:expandable` + `#expanded`-Slot.
- **Sticky-Header**: `:sticky-header` damit Header bei Scroll bleibt.
