# Live-Editor-Bridge

Verbindet den Web-Checker mit dem CMS4-Live-Editor (LE). Wenn ein LE-Tab für
die geprüfte Domain offen ist, kann ein Item per Klick im LE hervorgehoben
werden.

## Erkannte LE-Hosts

[`useLiveEditorBridge.js`](../src/composables/liveEditor/useLiveEditorBridge.js)
führt eine Liste:

```js
const EDITOR_HOST_PATTERNS = [
  /^le-cms4\.[\w.-]+$/,    // Staging/Preview
  /^cms4\.euroweb\.de$/,   // Production
]
```

### Domain-Match

Zwei Strategien, je nach Host:

| Host | Wie wird die Audit-Domain erkannt |
|---|---|
| `cms4.euroweb.de` | URL-Path `/website/<domain>/…` |
| `le-cms4.<…>` | Probe `window.leConfig.website.domain` im MAIN-World des Tabs |

`findEditorTabFor(checkedUrl)` durchsucht alle offenen Tabs und gibt den
ersten passenden zurück.

## API

```js
const {
  editorTab,         // ref<chrome.tabs.Tab | null>
  focusItem,         // (item) => fokussiert + scrollt + highlight im LE
  refresh,           // erneut nach LE-Tab suchen (idempotent)
  requestEditable,   // Batch-Anfrage: ist Item editierbar im LE? — debounced
  getEditable,       // (item) → true/false/undefined (cached)
  openEditor,        // öffnet neuen Tab zu cms4.euroweb.de/website/<domain>/
} = useLiveEditorBridge()
```

`editorTab` ist reaktiv und aktualisiert sich automatisch über
`chrome.tabs.onUpdated/onCreated/onRemoved` — wenn der User den LE
nachträglich öffnet, springt der Status um, ohne dass die Sidebar neu geladen
werden muss.

### Editierbarkeit pro Item

Items zählen als editierbar, wenn das Element einen `[data-le-eid]`-Vorfahren
hat, dessen `data-element-type` in einer der zwei Listen steht:

```js
CONTENT_TYPES    // editierbar wenn das Item INNERHALB des Wrappers liegt
                 // 'article', 'title', 'text', 'picture', 'button', 'html',
                 // 'file', 'audio', 'video', 'logo', 'horizontalLine',
                 // 'imprint', 'gdpr', 'imprintContent', 'gdprContent',
                 // 'contactForm', 'contactFormContent', 'newsletter',
                 // 'accessManager', 'galleryImage'

STRUCTURAL_TYPES // editierbar nur wenn das Item GENAU der Wrapper ist
                 // 'container', 'grid', 'column', 'navigation', 'gallery',
                 // 'newsfeed', 'loopMaster', 'loopChild', 'loopPlaceholder',
                 // 'module'
```

`text` deckt Rich-Text-Blöcke ab (Headings, Paragraphs, Listen) — wer in
einem `<… data-element-type="text">` sitzt, ist editierbar.

Ein `<img>` zählt als editierbar, wenn es z.B. innerhalb eines
`<figure data-element-type="picture">` lebt. Ein `<nav>` selbst ist
editierbar wenn es das `data-element-type="navigation"`-Wrapper-Element ist.

## Pencil-Button im UI

### Standard-Verhalten ([ModuleItem.vue](../src/components/ui/display/ModuleItem.vue))

```
isLiveEditable === true     → Pencil sichtbar, Klick fokussiert im LE
isLiveEditable === false    → Pencil ausgeblendet
```

### Image-spezifisch ([ImageItem.vue](../src/services/web-checker/modules/images/components/ImageItem.vue))

ImageItem unterdrückt den Standard-Pencil über `<ModuleItem hide-editor-button>`
und rendert seinen eigenen mit drei Zuständen:

| State | Bedingung | UI |
|---|---|---|
| `focus` | LE-Tab offen + Item editable | grau, Hover Primary, Klick fokussiert |
| `open` | kein LE-Tab offen | Primary-getintet, Klick öffnet neuen Tab |
| `inert` | LE-Tab offen, aber Item nicht editable | disabled (40 % Opacity), Tooltip erklärt |

`openEditor()` baut die URL `https://cms4.euroweb.de/website/<auditDomain>/`.
Wenn der CMS4-OIDC-Login noch nicht erfolgt ist, schickt der Browser den User
einmal durch den Login — danach erkennt die Bridge den frisch geöffneten Tab
automatisch über die Tab-Watcher.

## Per-Modul abschalten

```json
{
  "actions": { "liveEditor": false }
}
```

Versteckt den Pencil in jedem Item dieses Moduls. Default: `true`. Siehe
[module-api.md](./module-api.md#modulejson).
