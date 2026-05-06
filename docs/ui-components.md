# UI-Bausteine

Globale Komponenten und Composables, die quer durch die Extension verwendet
werden. Auto-Discovery über [`components/ui/index.js`](../src/components/ui/index.js)
glob't `*.vue` rekursiv und registriert sie als globale Komponenten —
kein expliziter `import` an der Call-Site nötig.

## `<BaseButton>` — der zentrale Button

Eine Komponente für alles. Variant-Prop entscheidet über Stil. Optional
`tooltip`, optional `icon`. Class-Override über `class=""` wird auf den inneren
`<button>` durchgereicht (`inheritAttrs: false`).

### Varianten

| Variant | Use-Case |
|---|---|
| `primary` *(default)* | Voller Block-Button, Primary-Color, Footer-CTA |
| `secondary` | Voller Block, Secondary-Color |
| `ghost` | Voller Block, dezent — sekundäre Aktion |
| `icon` | Kleiner Icon-Button, Hover wechselt zu Primary |
| `icon-error` | Wie `icon`, Hover wechselt zu Error (z.B. Ignorieren) |
| `icon-success` | Wie `icon`, Hover wechselt zu Success |
| `icon-alert` | Wie `icon`, Hover wechselt zu Alert (z.B. Retry) |
| `header-icon` | Buttons im AppHeader (auf farbigem Background, `text-black/X`) |
| `square` | h-9 w-9 bordered Surface-Button (z.B. Zoom +/-) |
| `square-sm` | h-7 w-7 Variante mit `:active` (Modul-Toolbar-Toggles) |
| `surface-icon` | w-7 h-7 ohne Border (Drawer-Close, ClaudeResult-Buttons) |
| `circle` | Round Ring-Wrapper (Avatar-Trigger) |
| `send` | Klein, Primary-Fill (Chat-Send-Button) |
| `pill` | Bordered Chip mit Icon + Label |
| `pill-toggle` | Wie `pill`, mit `:active` Toggle-State |

### Standard-Props

```vue
<BaseButton
  variant="icon"
  icon="mdiPencilOutline"     <!-- spart einen <Icon>-Slot -->
  :icon-size="13"
  :tooltip="t('Edit')"        <!-- wrappt automatisch in <Tooltip> -->
  :loading="busy"             <!-- Spinner: groß bei block, klein bei icon -->
  :disabled="false"
  :active="isOn"              <!-- nur für *-toggle Varianten -->
  @click="…"
>
  Optional Slot-Inhalt
</BaseButton>
```

## `<Tooltip>` — gestylter Hover-Tooltip

Ersetzt `title="…"` mit teleportiertem Float-Element. Auto-Flip oben → unten
am Viewport-Rand.

```vue
<Tooltip :text="t('Element nicht sichtbar')">
  <span class="…">…</span>
</Tooltip>
```

- Slot rendert *einen* Child. Wrapper ist `<span class="contents">` →
  `display: contents` macht ihn layout-neutral, der Slot-Child bleibt
  direkter Flex/Grid-Child seines echten Parents.
- Show-Delay 350 ms (kein Flackern), Hide-Delay 80 ms.
- Klick versteckt sofort.
- Leerer `text` deaktiviert den Tooltip — wie `title=""`.

`<BaseButton :tooltip>` nutzt diese Komponente intern.

## `<ConfirmDialog>` — Action-Bestätigung

Center-Modal, teleportiert zu `body`. Optional Notiz-Textarea.

```vue
<ConfirmDialog
  :open="open"
  :title="t('Diesen Hinweis ignorieren?')"
  :message="t('Wird ausgeblendet, kann jederzeit wiederhergestellt werden.')"
  :confirm-text="t('Ignorieren')"
  variant="danger"
  with-note
  :note-placeholder="t('Warum? (optional)')"
  @update:open="open = $event"
  @confirm="(note) => doIgnore(note)"
/>
```

- `variant="danger"` macht den Confirm-Button rot
- `with-note` blendet Textarea ein, fokussiert sie automatisch
- `Ctrl/Cmd + Enter` in der Textarea bestätigt
- `confirm`-Event emittiert die getrimmte Notiz (leer = `''`)
- `cancel`-Event beim Abbrechen oder Backdrop-Click

Wird aktuell beim Ignorieren von Issues genutzt — siehe
[useIgnoreList](#useignorelist--ignorieren-von-issues).

## `useIgnoreList` — Ignorieren von Issues

Persistenter Store unter Key `wp-ignored-issues`. Pro Origin + Modul eine
Liste von `{ message, note, addedAt }`. Notiz wird im Confirm-Dialog erfasst.

```js
import { useIgnoreList } from '@/services/web-checker/composables/useIgnoreList.js'

const { add, remove, isIgnored, getNote, listFor, clearOrigin } = useIgnoreList()

add('https://example.com', 'images', 'Missing alt attribute', { note: 'Drittanbieter-Widget' })
isIgnored('https://example.com', 'images', 'Missing alt attribute')  // true
getNote('https://example.com', 'images', 'Missing alt attribute')    // 'Drittanbieter-Widget'
```

`useModuleFilter` markiert Items als `_ignored: true` wenn alle ihre
non-success-Issues in der Ignore-Liste stehen. Im Filter „Ignorierte" werden
die wieder eingeblendet — mit der Notiz im Expand-Bereich.

## Globaler Toast — `useToast`

(Bestand vor diesen Änderungen.) Siehe
[components/ui/feedback/ToastContainer.vue](../src/components/ui/feedback/ToastContainer.vue)
für die Render-Logik. Verwendet auch `<BaseButton variant="icon">` für den
Close-Button.
