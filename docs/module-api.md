# Modul-API-Referenz

Vollständiger Vertrag für Modul-Autoren. Schnellstart in
[creating-a-module.md](./creating-a-module.md), Architektur in
[architecture.md](./architecture.md).

---

## `module.json`

```jsonc
{
  "id":            "my-check",       // string, Pflicht, kebab-case, eindeutig
  "name":          "My Check",       // string, Pflicht, Translation-Key
  "description":   "Beschreibung",   // string, optional, Translation-Key
  "icon":          "mdiCheck",       // string, optional, MDI-Icon (camelCase)
  "active":        true,             // boolean, default true
  "order":         50,               // number, optional

  // Web-Checker-spezifisch:
  "checkOnReload": false,            // boolean, optional
  "allowChatBot":  true,             // boolean, optional — Legacy-Alias für actions.chatbot
  "defaultFilter": "issues",         // 'all' | 'issues' | 'errors' | 'warnings'

  // Action-Buttons pro Item ein/ausblenden, alle default true.
  // Legacy `allowChatBot: false` wird respektiert wenn `actions.chatbot` nicht gesetzt ist.
  "actions": {
    "liveEditor":    true,           // mdiPencilOutline — im Live-Editor öffnen
    "chatbot":       true,           // mdiRobot — im wwwe-Chat analysieren
    "claudeExplain": true,           // mdiAutoFix — mit Claude erklären
    "ignore":        true,           // mdiEyeOffOutline — Hinweis ignorieren
    "altText":       true            // mdiTagTextOutline — nur Image-Modul
  },

  // Pfad-Filter, optional pro Modus:
  "singlePage": {                    // (Single-Page-Check)
    "runOnPaths":  ["/", "/contact"],  // Whitelist (leer/fehlt = überall)
    "skipOnPaths": ["/checkout"]       // Blacklist, gewinnt
  },
  "fullSite": {                      // (Site-Wide-Check)
    "runOnPaths":  [],
    "skipOnPaths": []
  }
}
```

Statische Keys können auch aus `index.js` exportiert werden — Loader merged,
JSON gewinnt bei Konflikten.

---

## `index.js`

### Web-Checker-Modul

Default-Export ist die Checker-Funktion. Läuft im Page-Kontext, wird via
`Function.toString()` serialisiert — Modulebene-Imports und -Konstanten gehen
verloren!

```ts
type Check = (apiConfig?: any) => Result | Promise<Result>
```

```js
export const overlay = null    // OverlayConfig | null
export const apiConfig = null  // any — wird als erstes Argument übergeben

export default async function check(config) {
  const t = window.__t
  const { addItem, finish } = createCheckResult()
  // ... DOM-Inspektion ...
  return finish()
}
```

| Named-Export | Typ | Default | Verwendung |
|---|---|---|---|
| `overlay` | `OverlayConfig \| null` | `null` | Aktiviert die Badge-Ebene auf der Seite |
| `apiConfig` | `any` | `null` | Wird als erstes Argument an `check()` übergeben — z.B. für Backend-URLs aus `@/config/api.js` |

#### `OverlayConfig`

```ts
interface OverlayConfig {
  enabled: boolean
  labelFn: (item) => string    // Badge-Text. Läuft im Sidebar-Kontext (nicht Page!)
  onText:  string              // Translation-Key des Toggle-Labels (aktiv)
  offText: string              // Translation-Key des Toggle-Labels (inaktiv)
}
```

`labelFn` läuft in der Sidebar — kann reguläre Imports und `useI18n` nutzen:

```js
import { useI18n } from '@/composables/i18n/useI18n.js'
const { t: tSidebar } = useI18n()

export const overlay = {
  enabled: true,
  labelFn: (item) => `${item.ratio}:1 — ${tSidebar(item.level)}`,
  onText:  'Hide contrast',
  offText: 'Show contrast',
}
```

### Chatbot-Provider-Modul

Default-Export ist die `send`-Funktion:

```ts
type Send = (ctx: { text: string, history: ChatMessage[], chatId: string })
  => Promise<{ reply: string } | { error: string }>
```

| Named-Export | Typ | Verwendung |
|---|---|---|
| `accentColor` | `string` | CSS-Farbe des Avatars (`'#D97757'` oder `'var(--color-primary)'`) |
| `welcomeText` | `string` | Translation-Key des Empty-State-Texts |
| `suggestions` | `string[]` | Translation-Keys der Suggestion-Buttons |

---

## `views/Index.vue`

Sidebar-Page des Moduls.

**Web-Checker minimal:**
```vue
<script setup>
import MyItem from '../components/MyItem.vue'
</script>
<template>
  <ModulePage moduleId="my-check" label="My Check" :itemComponent="MyItem" />
</template>
```

**Web-Checker mit custom Slot:**
```vue
<template>
  <ModulePage moduleId="my-check" label="My Check">
    <template #default="{ result, raw }">
      <CustomStats :result="raw ?? result" />
      <YourGrouping :items="result.items" />
    </template>
  </ModulePage>
</template>
```

**Chatbot-Provider:** Empty-State-Komponente — siehe `chatbot/modules/wwwe/views/Index.vue` und `chatbot/modules/claude/views/Index.vue`.

---

## `views/SettingsView.vue` (optional)

Modul-eigene Settings. Erscheint automatisch unter Service-Einstellungen, wenn
der Service `<ServiceSettingsPage>` benutzt.

```vue
<script setup>
import { useI18n } from '@/composables/i18n/useI18n.js'
import { useModuleSettings } from '@/composables/settings/useModuleSettings.js'

const { t } = useI18n()
const settings = useModuleSettings('my-check', { foo: '', items: [] })
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <AppHeader showBack :subtitle="t('Settings')" />
    <div class="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">
      <!-- ... deine Settings-Cards ... -->
    </div>
  </div>
</template>
```

`useModuleSettings(moduleId, defaults)` gibt das reaktive State-Slice zurück.
Persistiert in `chrome.storage.local` unter `wp-module-settings` (eine Map über
alle Module). Im Page-Kontext zugänglich als `window.__moduleSettings.<moduleId>`.

---

## `background.js` (optional)

```ts
export const type:  string         // einzelner Message-Type
export const types: string[]       // ODER mehrere Types

export async function handle(
  msg: any,
  sendResponse: (reply: any) => void,
  sender: chrome.runtime.MessageSender,
): Promise<void>
```

```js
export const types = ['MY_KEY_SET', 'MY_KEY_GET']

export async function handle(msg, sendResponse) {
  switch (msg.type) {
    case 'MY_KEY_SET': /* ... */ break
    case 'MY_KEY_GET': /* ... */ break
  }
}
```

Auto-loaded vom `src/background.js`. Aufruf aus dem Sidebar-Code via
`chrome.runtime.sendMessage`, oder im Web-Checker-Checker via
`runInBackground(type, payload)`.

---

## Window-Helper im Page-Kontext

Vor jedem Web-Checker-Run via `useCheckRunner.injectHelper()` injiziert.

### `createCheckResult()`

```ts
function createCheckResult(): {
  errors:   { message: string }[]
  warnings: { message: string }[]
  items:    Item[]
  addItem:  (el: Element, checks: Check[], extra?: object) => void
  finish:   () => Result
}

interface Check {
  when:        boolean
  type:        'error' | 'warning' | 'success'
  title:       string
  description?: string
}

interface Item {
  type:    'error' | 'warning' | 'success'
  issues:  { type, message }[]
  visible: boolean
  element: string                       // UUID
  ...extra                              // alles aus addItem(_, _, extra)
}

interface Result {
  errors:       { message: string }[]   // dedupliziert mit (Nx)-Suffix
  warnings:     { message: string }[]
  errorCount:   number
  warningCount: number
  items:        Item[]
}
```

`addItem(el, checks, extra)`:
- `checks` filtert `when: false` und `type: 'success'` aus den Issues; leitet
  Item-Type vom schlimmsten Schweregrad ab
- `extra` wird ins Item gespreaded — typisch: `text`, `name`, `href`, `_meta`,
  modul-spezifische Felder

### `setHighlightElement(): string`

Frische UUID. Wird intern von `addItem` aufgerufen — selten direkt nötig.

### `isElementVisible(el): boolean`

Rekursive Sichtbarkeitsprüfung (display, visibility, opacity, transform,
Vorfahren). Setzt `item.visible` in `addItem`.

### `hasVisualContent(el): boolean`

`true` wenn das Element irgendetwas rendert — Text, Kind-Medien,
Pseudo-Element-Content, background-image. Nützlich um Icon-only-Elemente von
leeren zu unterscheiden.

### `runInBackground(type, payload?): Promise<any>`

Promise-Wrapper um `chrome.runtime.sendMessage`.

```js
const reply = await runInBackground('MY_FETCH', { url })
```

### Page-Globals direkt auf `window`

Modul-Checker laufen im **Isolated Content-Script World** — Page-Skript-Globals
wie `window.accessibility` (CMS-Bars, Plugins, jQuery, GSAP, …) sind dort
normalerweise **unsichtbar**. `injectHelper` snapshottet vor jedem Audit das
Page-Main-World-`window` (via `world: 'MAIN'` Bridge) und kopiert die
Page-Script-Properties auf das Isolated-World-`window`. Browser-Built-Ins
(`location`, `document`, `fetch`, …) werden **nicht** überschrieben.

Modul-Code greift damit einfach via `window.X` zu:

```js
const a11y     = window.accessibility?.settings?.services?.contrast
const pcConfig = window.pCServiceTemplates
const $        = window.jQuery
```

Funktionen werden bei der Serialisierung gestrippt (Message-Passing-Limit) —
nur Property-Reads, keine Methoden-Calls auf Page-Globals.

`document`, `location`, etc. sind echte Live-Refs (DOM ist cross-world
geteilt). Mutationen wirken sofort auf das gerenderte Page-DOM:

```js
document.querySelectorAll('iframe').forEach(...)
document.documentElement.classList.add('foo')   // für Audit-Dauer
location.hostname
```

### `window.cms` — CMS-Version-Erkennung

```ts
interface Cms {
  version:           'cms4' | 'cms3' | 'unknown'
  dataFwVersion:     string | null     // CMS4 framework version, z.B. '1.13.1'
  dataFw:            string | null     // CMS3 framework version
  legacy:            boolean           // true wenn CMS3 ohne /js/_require.js
  hasPrivacyControl: boolean
  hasRequireIt:      boolean
  files?:            { ewcms3: boolean, siteJs: boolean, requireJs: boolean }
}
```

Detection-Reihenfolge: HTML-`data-fw-version` → CMS4 / `data-fw` → CMS3 /
HEAD-Probes auf `/ewcms3/js/ewcms_js.js`, `/js/_require.js`, `/js/site.js`
als Fallback.

```js
if (window.cms.version === 'cms4') { … }
```

### `window.consent` — privacyControl-Consent-State

`Record<string, boolean> | null` — Snapshot von `window.privacyControl.get('all')`
zur Audit-Zeit. Per-Service-Lookup:

```js
if (window.consent?.googlemaps === true) { … }
```

### `__t(key, params?): string`

Übersetzungsfunktion. Lookup: `currentLang[key] → en[key] → key`. Platzhalter
`{name}` mit `params: { name: '...' }`. Siehe [i18n.md](./i18n.md).

### `__ignoreSelectors: string[]`

Globale Ignore-Liste (Built-ins minus User-Disabled, plus User-Custom). Module
können sie zusätzlich zu eigenen Filtern berücksichtigen:

```js
const IGNORE = ['.my-skip', ...(window.__ignoreSelectors ?? [])]
```

### `__moduleSettings: { [moduleId]: any }`

Snapshot aller `useModuleSettings`-Stores. Modul-eigene Settings:

```js
const ignoreWords = window.__moduleSettings?.spellcheck?.ignoreWords ?? []
```

---

## `_meta` — Element-Lookup

`_meta` jedes Items sagt dem Framework, wie es das Element auf der Seite
wiederfindet. Auflösungsreihenfolge in `useModuleAttributes.findEl`:

| Strategie | Form | Wann |
|---|---|---|
| CSS-Selektor | `{ selector: '#x' }` | Du hast das Element selbst injiziert |
| Tag + Index | `{ tag: 'A', idx: 5 }` | n-tes Element dieses Tags (häufigster Fall) |
| Text-basiert | `{ text: 'foo', tag: 'P' }` | Match über Textinhalt |
| Background-Image | `{ isBackground: true, idx: 2 }` | `<div>` mit CSS-bg-image |
| Bild-Fingerprint | `{ src, name, alt }` | Bild-Lookup (Heuristik) |

**Wichtig**: ohne `_meta` funktionieren Overlays, Highlight und HTML-Extraktion
für den Chatbot nicht.

---

## `translations/translations.json`

```json
{
  "de": {
    "Some Key": "Übersetzung",
    "Found {count} items": "{count} Treffer gefunden"
  },
  "en": { /* optionale Overrides — fehlende Keys fallen auf den Key zurück */ }
}
```

Auto-Discovered an drei Ebenen (global, service, modul). Mehr in [i18n.md](./i18n.md).

---

## Sidebar-UI-Komponenten

Alle global registriert via `components/ui/index.js` — kein manueller Import
nötig.

### `<ModulePage>` (`components/ui/layout/`)

Wrappt Modul-Sidebar-Page mit Standard-Layout (Web-Checker).

| Prop | Typ | Default | Beschreibung |
|---|---|---|---|
| `moduleId` | String | erforderlich | Schlägt Modul-Config nach |
| `label` | String | erforderlich | Section-Titel |
| `itemComponent` | Component | `null` | Wird pro `result.items[i]` gerendert |
| `runningMessage` | String | `''` | Caption unter dem Spinner |
| `emptyMessage` | String | `'Noch nicht geprüft …'` | Idle-State-Text |
| `showStats` | Boolean | `true` | ModuleStats-Header anzeigen |

Default-Slot: `{ result, raw }` für custom Rendering.

### `<ServiceSettingsPage>` (`components/ui/layout/`)

Wrapper für Service-Settings-Pages. Rendert AppHeader, Slot, und automatisch
unten dran die Liste der Modul-Settings.

```vue
<ServiceSettingsPage>
  <!-- service-spezifische Settings hier -->
</ServiceSettingsPage>
```

### `<ModuleSection>` (`components/ui/display/`)

Innerer Teil von ModulePage: Filter-Dropdown, Recheck-Button, Overlay-Toggle,
Items-Slot. Normal nicht direkt nötig.

### `<ModuleItem>` (`components/ui/display/`)

```vue
<ModuleItem :item="normalized" variant="box">
  <template #expand>
    <DetailRow label="Foo">{{ item.foo }}</DetailRow>
  </template>
</ModuleItem>
```

`variant`: `'box'` (Card) oder `'list'` (flach). Leitet Display-Felder vom
Item ab (`title` aus `title|text|name|href`, `details` aus `details|tag|href`,
`image` aus `image|src`).

### `<DetailRow>` (`components/ui/display/`)

```vue
<DetailRow label="Selector" mono width="w-24">{{ selector }}</DetailRow>
```

Props: `label` (Pflicht), `width` (Default `w-20`), `mono` (boolean).

### `<ModuleStats>` (`components/ui/display/`)

Gesamt/Fehler/Warnungen-Badges.

| Prop | Default |
|---|---|
| `result` | erforderlich |
| `total` | `true` |
| `errors` | `true` |
| `warnings` | `true` |

Default-Slot für zusätzliche StatBox-Zellen.

### Weitere Bausteine

| Komponente | Zweck |
|---|---|
| `<AppHeader>` | Header mit Title/Subtitle/Back-Button/QuickNav |
| `<BreadCrumb>` | Auto-Pfad aus `route.meta` |
| `<QuickNav>` | Burger-Sidebar (Dashboard, Services, Einstellungen) |
| `<CardItem>` | Klickbare Liste-Item-Card mit Icon/Title/Description |
| `<StatBox>` | Großer Stat-Wert mit Label (Variants: neutral/success/muted) |
| `<EmptyState>` | Zentrierter Text-Wrapper |
| `<LoadingSpinner>` | Spinner |
| `<AlertItem>` | Farbige Alarm-Box (`type`: error/warning/info) |
| `<StatusPill>` | Inline-Pill für Errors+Warnings-Counts |
| `<TabStatusBadge>` | Live-Editor / URL-changed / etc. Anzeige |
| `<SectionLabel>` | Uppercase muted Section-Header |
| `<BaseButton>` | Primary/Secondary/Ghost-Button mit Loading-State |
| `<InputField>` | Standard-Input |
| `<Icon>` | MDI-Icon-Wrapper |
