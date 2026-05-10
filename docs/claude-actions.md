# Claude-Integration

Der Claude-Provider hat zwei Rollen:

1. **Conversational Chatbot** im Chat-Tab — wie der wwwe-Chatbot, nur ein
   anderer Backend-Anbieter. Standard-Provider-Modul-Vertrag.
2. **One-Shot-Aktionen** auf Items im gesamten Web-Checker — eigene
   Drawer-UI, keine Conversation. Hier dokumentiert.

## API-Key + Validation

Settings: **Service-Settings → Chat → Claude → API Key**. Beim ersten Speichern
und über den „Test now"-Button wird der Key per `GET /v1/models?limit=1` gegen
`api.anthropic.com` validiert. Nur ein bestätigter Key gilt als nutzbar.

## `useClaude()` — zentrale Verfügbarkeits-Quelle

```js
import { useClaude } from '@/services/chatbot/modules/claude/composables/useClaude.js'

const {
  isAvailable,      // computed: true ⇔ Provider-aktiv ∧ Key gespeichert ∧ validiert
  isEnabledByUser,  // computed: nur Provider-Toggle (siehe chatbot-providers.md)
  ensureValidated,  // async: pingt API einmal pro Session, single-flight
  invalidate,       // löscht den Validated-Status (z.B. nach 401-Fehler)
  run,              // async ({ system, messages, model?, max_tokens? }) → { text, raw }
} = useClaude()
```

### Eager-Validation

`isAvailable` ist Pflicht-Vorbedingung für jeden Claude-UI-Button. Damit der
Button bei vorhandenem Key direkt rendert (statt erst nach dem ersten Klick),
löst ein einmaliger `watch` automatisch `ensureValidated()` aus, sobald
Provider + Key beide vorhanden sind. Singleton: nur ein Ping pro
Browser-Session.

### `run()` — Generic Prompt-Runner

Der Service-Worker-Handler `CLAUDE_RUN` schickt `system` + `messages` an
`POST /v1/messages` und gibt `content`-Array zurück. `run()` extrahiert daraus
den ersten Text-Content. Bei `api_key`/`auth`-Fehlern wird der Validated-Status
sofort invalidiert.

Beispiel — Vision-Call mit Image-URL:

```js
const result = await claude.run({
  max_tokens: 150,
  system: 'You write concise alt text in German.',
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'url', url: 'https://example.com/img.jpg' } },
      { type: 'text',  text:   'Filename: hero.jpg' },
    ],
  }],
})
console.log(result.text)
```

## UI-Bausteine

### `<ClaudeButton>` — Trigger

Wrap um `<BaseButton>`, rendert nur wenn `useClaude().isAvailable === true`.
Zwei Varianten:

- `variant="icon"` (default) — Zauberstab-Icon (`mdiAutoFix`), Item-Action-Reihe
- `variant="pill"` — Bordered Chip mit Icon + Label (für Toolbar-Aktionen wie
  „Bericht erstellen")

Zeigt Loading-Spinner solange ein Run läuft.

### `<ClaudeResult>` — Bottom-Drawer

Teleport-basiert auf `body`. Rendert Title + entweder Loading-Spinner /
Error-AlertItem / formatierter Text + Copy-to-Clipboard. Markdown-Light:
`**bold**`, `*italic*`, `` `code` ``, Newline → `<br>`. „Powered by
Claude"-Footer.

API:
```vue
<ClaudeResult
  :open="open"
  :title="t('Suggested alt text')"
  :loading="loading"
  :error="error"
  :text="text"
  @update:open="open = $event"
/>
```

## Aktionen im Detail

| Aktion | Trigger-Stelle | Icon | Eingabe | Ausgabe |
|---|---|---|---|---|
| **Item erklären** | jeder ModuleItem mit Issue | `mdiAutoFix` | Modul, Page-URL, Element-Label, Issues, getrimmtes Element-HTML | German prose, 3–6 Absätze |
| **Site-Bericht** | Site-Check-View nach Abschluss | `mdiAutoFix` (pill) | Aggregate pro Modul + Beispielseiten | Fazit + Top-Risiken + Next Steps |
| **Alt-Text** | Image-Item, alle `<img>` | `mdiTagTextOutline` | Image-URL via Vision + Filename + ggf. aktueller Alt | 5–15 Wörter Alt-Text |
| **Meta-Description** | Overview-Item `meta-desc` mit Issue | `mdiAutoFix` (pill) | Page-Title + H1 + Body-Text (3000 chars) | 120–160 Zeichen Meta-Description |

Alle vier verwenden `claude.run()` mit modulspezifischen System-Prompts auf
Deutsch. Output wird vor Anzeige getrimmt + ggf. um Anführungszeichen
bereinigt.

### Per-Modul abschaltbar

Im jeweiligen `module.json`:

```json
{
  "actions": {
    "claudeExplain": false,   // versteckt den Zauberstab in jedem Item dieses Moduls
    "altText":       false    // nur Bilder-Modul
  }
}
```

Site-Bericht und Meta-Description sind feste Trigger an spezifischen
View-Stellen und nicht via `actions` config-bar.

### Per-Modul tailored System-Prompt

Jedes Modul kann in seinem `index.js` einen `claude`-Export hinzufügen, der
„Item erklären" auf die Domäne des Moduls zuspitzt — statt des generischen
QA-Engineer-Prompts kriegt Claude einen Accessibility-, Contrast-,
DSGVO- oder Schema.org-„Hut" aufgesetzt:

```js
export const claude = {
  title: 'Kontrast-Vorschlag',
  systemPrompt:
    'You are a brand designer and accessibility expert. ' +
    'Reply in German, suggest a hex color that passes WCAG AA …',
  maxTokens: 1200,  // optional, default 800
}
```

`useModuleSetup` zieht den Export durch zu `moduleOverlay.claude`, und
`ModuleItem.vue` benutzt den Prompt + den Title für den Drawer. Fehlt der
Export, gilt der Default-„senior web QA engineer"-Prompt.

Verfügbare Module-Prompts: accessibility, console, contrast, headings, images,
links, overview, performance, privacy, sitemap, spellcheck, structured-data,
validation — alle im jeweiligen `modules/<id>/index.js`.

## Was Claude NICHT macht

- Kein Streaming — alle Antworten sind one-shot.
- Keine Conversation auf Items — wer Folgefragen stellen will, soll den
  „Im wwwe-Chat analysieren"-Button (Roboter-Icon) nehmen. Der wwwe-Chatbot ist
  ein RAG mit Wiki-Hits, geeignet für Multi-Turn.
- Kein Tool-Use, keine Function-Calling.
