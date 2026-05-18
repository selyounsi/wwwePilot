# Form-Felder + Layout-Komponenten

Globale Komponenten für Formulare, Modale, Cards, KPI-Tiles, Listen und
Tabs. Alle auto-registriert via `components/ui/index.js`, kein Import.

## Form-Felder

### `<FormField>` — Text-Input

```vue
<FormField v-model="email" type="email" label="Email" />
<FormField v-model="q" dense placeholder="Search…" prefix-icon="mdiMagnify" />
<FormField v-model="pwd" type="password" :error="err.pwd" helper-text="≥ 8 chars" />
```

Props:

| Prop          | Type      | Notes |
|---------------|-----------|-------|
| `modelValue`  | string    | `v-model` |
| `label`       | string    | Optional, rendered above the input as uppercase tracking-wide |
| `placeholder` | string    | |
| `type`        | string    | `text` (default), `email`, `password`, `number`, `datetime-local`, … |
| `density`     | string    | `compact` (xs, py-1.5) \| `default` (sm, py-2) \| `loose` (base, py-3) |
| `dense`       | boolean   | Shortcut for `density="compact"` — used in admin filter bars |
| `prefixIcon`  | string    | MDI icon name, rendered inside the input on the left |
| `suffixIcon`  | string    | Same, on the right |
| `error`       | string    | Shows red border + error message under the field |
| `helperText`  | string    | Muted hint under the field (suppressed when error is set) |
| `disabled`    | boolean   | |
| `mono`        | boolean   | Monospace input — useful for IDs, paths, selectors |
| `fullWidth`   | boolean   | Default `true`. Set `false` for inline filter inputs |

Extra HTML attributes (`min`, `max`, `maxlength`, `@keydown`, etc.) are
forwarded onto the underlying `<input>` via `inheritAttrs: false`.

### `<SelectField>` — Dropdown

Two ways to populate:

```vue
<!-- Array of {value, label} — labels are run through t() unless translate:false -->
<SelectField v-model="filterStatus" dense :options="[
  { value: '',     label: 'All statuses' },
  { value: 'open', label: 'Open' },
]" />

<!-- Default slot for custom <option>s (numbers, raw HTML, etc.) -->
<SelectField v-model="days" dense>
  <option :value="7">Last 7 days</option>
  <option :value="30">Last 30 days</option>
</SelectField>
```

Same `density` / `dense` / `error` / `helperText` props as `<FormField>`.

### `<TextareaField>`

```vue
<TextareaField v-model="note" :rows="4" label="Note" />
<TextareaField v-model="note" auto-grow placeholder="…" max-height="200px" />
```

`auto-grow` uses the modern `field-sizing: content` CSS — no JS height
measurement. Combine with `max-height` to cap growth.

### `<CheckboxField>`

```vue
<CheckboxField v-model="enabled" label="Enable feature" />
<CheckboxField v-model="forceAdd" label="Force" description="Skip validation" />
<CheckboxField v-model="forceAdd" label="Add anyway" :info-tooltip="t('force.help')" />
```

Use `description` for a short muted line below the label, or
`infoTooltip` to render an `<InfoHint>` icon next to the label that
reveals a longer explanation on hover.

### `<InfoHint>` — info-icon with tooltip

Single-line label too cramped to fit a full explanation? Drop an
`<InfoHint>` next to it.

```vue
<label class="text-xs">
  Force <InfoHint :text="t('Skip LanguageTool validation — for brand names…')" />
</label>
```

Props: `text` (required, the tooltip body), `size` (icon px, default 12),
`icon` (default `mdiInformationOutline`), `tone` (`muted|primary|alert|error`).

## Modal

### `<BaseModal>`

Replaces 9 hand-rolled `<Teleport> + <Transition> + fixed inset-0`
boilerplates across the codebase. Used by `ConfirmDialog`, `ReportDialog`,
`ApiTokenCreateModal`, `ApiTokenRevealModal`.

```vue
<BaseModal v-model:open="show" title="Edit user" size="md">
  <template #actions>
    <BaseButton variant="pill" icon="mdiHelp" />
  </template>

  <FormField v-model="name" label="Name" />

  <template #footer>
    <BaseButton variant="ghost" @click="show = false">Cancel</BaseButton>
    <BaseButton class="ml-auto" @click="submit">Save</BaseButton>
  </template>
</BaseModal>
```

Props:

| Prop              | Default | Notes |
|-------------------|---------|-------|
| `open`            | —       | Required, use with `v-model:open` |
| `title`           | `''`    | Header text; override with `#header` slot |
| `size`            | `'md'`  | `sm` (max-w-sm), `md` (max-w-md), `lg` (max-w-2xl), `xl` (max-w-4xl), `custom` |
| `align`           | `'center'` | `top` for search-palette-style modals (Cmd+K) |
| `closeOnBackdrop` | `true`  | Click-outside closes |
| `closeOnEsc`      | `true`  | Escape closes |
| `noPadding`       | `false` | Removes the `p-4` from the body slot |

Body scroll is locked while open. Built-in close button in the header
emits the same close path as backdrop/Esc.

## Layout containers

### `<BaseCard>` — the standard surface

Single source of truth for `bg-surface-soft border border-border rounded-xl`.
86 vorkommen of that class cluster lived in the codebase before this
component.

```vue
<BaseCard title="Roles" subtitle="Click to edit">
  <template #actions>
    <BaseButton variant="pill" icon="mdiPencil" />
  </template>
  …content…
</BaseCard>

<BaseCard tone="primary" no-padding>
  <table>…</table>
</BaseCard>
```

Props: `title`, `subtitle`, `icon`, `tone` (`default|primary|success|danger|alert`),
`padding` (`sm|md|lg`), `noPadding`, `divided` (header gets bottom border).
Slots: `#header`, `#actions`, `#default`, `#footer`.

### `<PanelCard>` — BaseCard with separated header bar

The "labeled section with list/body" pattern — header sits in its own
bordered bar, body has no padding so a `<table>` or `<ul>` slots cleanly
underneath. Used 7+ times in spellcheck and friends.

```vue
<PanelCard title="Dictionary" icon="mdiBookOpenVariantOutline" :count="words.length">
  <template #actions>
    <BaseButton variant="pill" icon="mdiPlus" />
  </template>
  <ItemList :items="words">…</ItemList>
</PanelCard>
```

## KPI tile

### `<KpiTile>`

Replaces 23 raw `text-2xl font-bold tabular-nums` clusters across
Dashboard, Reports, Sites, Users, System, Health.

```vue
<KpiTile label="Active today" :value="42" sublabel="Avg 7 days: 35" />
<KpiTile label="Errors" :value="100" tone="error" />
<KpiTile
  label="Open reports"
  :value="3"
  tone="error"
  :active="filterStatus === 'open'"
  clickable
  @click="filterStatus = 'open'"
/>
```

Props:

| Prop        | Notes |
|-------------|-------|
| `label`     | Required, uppercase tracking-wide |
| `value`     | Big number/text |
| `sublabel`  | Muted line under the value |
| `icon`      | Optional icon in the header row |
| `tone`      | `default|error|alert|success|primary|muted` — colors the value |
| `clickable` | Renders as a `<button>` with hover-emphasis |
| `active`    | Highlight border (e.g. for filter tiles) |

Slots: `#value` (override the big number), `#sublabel`, `#header-extra`.

## Lists

### `<ItemList>` + `<ItemListRow>`

Single source for `<ul class="divide-y divide-border/30">` patterns —
10+ instances across spellcheck, selectors, flags, system/migrations,
AdminActivityStream.

```vue
<ItemList :items="words" :row-key="w => w.id" :empty-text="t('No words yet')" :max-height="288">
  <template #item="{ item: w }">
    <ItemListRow removable @remove="onDelete(w)">
      <code class="flex-1">{{ w.word }}</code>
      <span class="text-[10px] text-muted">{{ w.source }}</span>
    </ItemListRow>
  </template>
</ItemList>

<ItemList :items="domains" :row-key="d => d.origin">
  <template #item="{ item: d }">
    <ItemListRow clickable :active="active === d.id" @click="select(d)">
      {{ d.name }}
    </ItemListRow>
  </template>
</ItemList>
```

`<ItemList>` props: `items`, `rowKey`, `maxHeight` (scroll cap),
`emptyText`, `scroll`.

`<ItemListRow>` props: `removable`, `removeIcon`, `removeTooltip`,
`clickable`, `active`, `disabled`, `dense`. Events: `remove`, `click`.

## Tabs

### `<TabNav>`

Horizontal tab strip with optional per-tab count. Currently used in
`selectors/Index` for scope-switching, but kept generic for future
detail-view sub-sections.

```vue
<TabNav
  v-model="activeScope"
  :tabs="[
    { key: 'global', label: 'Global', count: 12 },
    { key: 'site',   label: 'Per site', count: 4, icon: 'mdiWeb' },
    { key: 'raw',    label: 'INTERNAL', translate: false },
  ]"
/>
```

`translate: false` on a tab skips the i18n lookup — useful for raw
scope/permission slugs.

## When to use which

| Want… | Component |
|-------|-----------|
| Page section with title + content | `<BaseCard>` |
| Section where content is its own list/table | `<PanelCard>` |
| Big-number stat at the top of a page | `<KpiTile>` |
| Modal/dialog | `<BaseModal>` |
| Confirmation dialog | `<ConfirmDialog>` (wraps `<BaseModal>`) |
| Text input | `<FormField>` (default density) or `<FormField dense>` (compact) |
| Dropdown | `<SelectField>` |
| Multi-line input | `<TextareaField>` |
| Boolean toggle | `<CheckboxField>` |
| Tabular data | `<DataTable>` (see [ui-data-table.md](ui-data-table.md)) |
| Divided list of items | `<ItemList>` + `<ItemListRow>` |
| Scope/category switcher | `<TabNav>` |
