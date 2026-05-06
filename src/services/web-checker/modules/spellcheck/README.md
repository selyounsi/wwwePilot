# Spellcheck-Modul

Rechtschreib-, Grammatik- und SEO-Prüfung für die geladene Seite. Backend ist
die wwwe SpellCheck-App, die intern LanguageTool + projekteigenes Wörterbuch
fährt.

## Was geprüft wird

1. **Sichtbarer Text** im DOM — extrahiert via `document.body.innerText`
   (alle `display: none`/`visibility: hidden`/`<script>`/`<style>`-Inhalte
   werden ausgespart).
2. **Bild-Alt-Texte** — alle `<img>`-Elemente werden mit ihrem `alt`, `src`
   und `title` mitgeschickt; das Backend prüft auf Tippfehler in Alt-Texten
   sowie SEO-Issues (z.B. doppelte Alt-Texte).
3. **Stil/Grammatik** — alles was LanguageTool kennt (Großschreibung,
   Zeichensetzung, doppelte Wörter, …).

Was passiert auf der Seite:
- Falsch geschriebene Wörter bekommen ein **`<span>` mit roter Wellenlinie**
  (`text-decoration: underline wavy #dc2626`).
- Whitespace-Markierungen (z.B. fehlendes Zeichen am Absatzende) bekommen
  ein **gelbes Box mit gestricheltem Outline**.
- Klick auf ein Item in der Sidebar scrollt zum Span und blendet ein
  Overlay-Badge mit Kategorie, Vorschlag und Erklärung ein.

## Architektur — wer macht was

```
[Seiten-Kontext]                  [Service Worker]              [Backend]
 index.js (check)                  background.js                 wwwe SpellCheck-App
 ├── DOM → text + images       →   CHECK_SPELLING handler   →   POST /api/spellcheck/check
 ├── runInBackground(...)                                    ←   { matches: [...] }
 ├── Span-Injektion                ↑
 └── Item-Liste an Sidebar         SPELL_DICT_ADD/DELETE     →   POST/DELETE /api/spellcheck/dictionary
                                   SPELL_IGNORE_ADD          →   POST /api/spellcheck/ignored
```

Endpoints in [src/config/api.js](../../../../config/api.js):
- `${BACKEND}/api/spellcheck/check` — Prüfung
- `${BACKEND}/api/spellcheck/dictionary` — projekteigenes Wörterbuch (pro Domain)
- `${BACKEND}/api/spellcheck/ignored` — global ignorierte Texte (pro Domain)

## JSON-Vertrag mit dem Backend

### Request-Body von `CHECK_SPELLING`

```json
{
  "text":     "Personalmanagement Jobbörse Über uns Kontakt …",
  "url":      "https://jobfind4you-de.wd4.securewebdemo.net/",
  "language": "de-DE",
  "domain":   "jobfind4you-de.wd4.securewebdemo.net",
  "images":   [
    { "alt": "Personaldienstleister …", "src": "/img/hero.jpg", "title": "" }
  ]
}
```

`url` ist seit Backend-Update **Pflichtfeld** — die Quell-URL wird für das
Backend-Feature „Letzte Prüfungen" gespeichert. Die Extension liest sie aus
`location.href` im Page-Kontext.

### Response

```json
{
  "language":      "de",
  "textLength":    4333,
  "totalMatches":  10,
  "filteredCount": 1,
  "duration":      0,
  "matches": [
    {
      "offset":      106,
      "length":      4,
      "fehler":      "Über",
      "korrektur":   "über",
      "message":     "Außer am Satzanfang werden nur Nomen und Eigennamen großgeschrieben.",
      "ruleId":      "DE_CASE",
      "category":    "Groß-/Kleinschreibung",
      "suggestions": ["über"],
      "context": {
        "text":   "...find4you.de Personalmanagement Jobbörse Über uns Kontakt 02565...",
        "offset": 43,
        "length": 4
      },
      "severity":    "hint"
    }
  ]
}
```

### SEO-Matches: spezielle Offset-Konvention

Match-Offsets `>= 2_000_000` (`SEO_OFFSET_MARKER`) sind **synthetisch** und
zeigen NICHT in den `text`-String, sondern markieren bildbezogene Issues:

```json
{
  "offset": 2000003,
  "length": 62,
  "fehler": "Personaldienstleister … in Gronau",
  "category": "SEO: Alt-Attribut",
  "ruleId": "ALT_DUPLICATE",
  "message": "Gleicher Alt-Text auf 2 Bildern: …"
}
```

`index.js` löst das Element auf, indem es im DOM nach `<img alt="…">` mit
übereinstimmendem `alt`-Attribut sucht. Der `text`-Body bleibt davon
unberührt.

## Sichtbarmachen im DOM (Span-Injection)

Für jeden Text-Match wird ein `<span>` um die Fundstelle gewickelt:

```html
<!-- vorher -->
"… Personalmanagement Jobbörse Über uns Kontakt …"

<!-- nachher -->
"… Personalmanagement Jobbörse "
<span data-wp-injected="spellcheck"
      data-wp-ref="spellcheck-0"
      style="text-decoration:underline wavy #dc2626;cursor:pointer;">Über</span>
" uns Kontakt …"
```

### Wichtige Garantien

- **Originaltext bleibt erhalten** — die Splits umfassen nur Wrapping in
  Spans, kein Char wird hinzugefügt oder entfernt.
- **Mehrere Matches pro Text-Knoten** funktionieren in einem Pass: alle
  Ranges werden gesammelt, der Knoten wird einmal in eine Sequenz von
  Text+Span+Text+…-Fragmenten umgebaut. So gibt's keine „Original-Knoten
  detached"-Race-Conditions.
- **Bei Modul-Verlassen** bleiben die Spans im DOM stehen — sie werden erst
  beim nächsten Check ersetzt. So sind die Wellenlinien + Badge-Klicks auch
  nach Sidebar-Navigation stabil.
- **Bei jedem Check-Run** löst der Modul-Code zuerst alle bestehenden Spans
  auf (`data-wp-injected="spellcheck"`-Cleanup) und startet dann die neue
  Injektion.

### Element-Lookup-Reihenfolge

Pro Match speichert das Item ein `_meta` mit Strategien für die
Wiederfindung des Elements (für Overlay-Badges + Live-Editor-Bridge):

| Priorität | Strategie | Wann |
|---|---|---|
| 1 | `selector: [data-wp-ref="spellcheck-N"]` | Direkt das injizierte Span (Standardfall) |
| 2 | `tag` + `idx` | n-tes Element des Tags — wenn der Span fehlt (z.B. nach Re-Render) |
| 3 | `contextText` Substring-Match | Sucht den umgebenden Satz in einem `<p>`/`<h*>`-Block |
| 4 | `fehler` Substring-Match | Letzter Versuch — findet das Wort selbst irgendwo |

Strategie 3 + 4 nutzt der Live-Editor-Bridge im LE-Iframe, wo unsere
`data-wp-*`-Attribute nicht existieren.

## UI-Flow in der Sidebar

### Listendarstellung

Items werden gruppiert nach `category` (Rechtschreibung, Zeichensetzung,
Groß-/Kleinschreibung, SEO: Alt-Attribut, …). Pro Item sieht der Mitarbeiter:

- **Title-Zeile**: `Kategorie → Korrektur` (z.B. „Groß-/Kleinschreibung → über")
- **Description-Zeile** (Expand): die LanguageTool-Erklärung
- **Context-Snippet**: ein Ausschnitt um die Fundstelle, falls verfügbar

### Badge-Overlay

Klick auf ein Item triggert `highlightElement()` → Page-Kontext rendert ein
Speech-Bubble-Badge über dem Span. Das Badge zeigt:

```
Groß-/Kleinschreibung → über
Außer am Satzanfang werden nur Nomen und Eigennamen großgeschrieben.
```

(Erste Zeile = `issue.message`, zweite Zeile = `issue.description`.)

### Custom-Wörterbuch + Ignore-Liste

Über Settings → Web-Checker → Spellcheck:

- **Eigene Wörter** (`SPELL_DICT_ADD`/`SPELL_DICT_DELETE`) — Wörter die das
  Backend ab sofort als bekannt akzeptiert (z.B. Marken-/Produktnamen).
  Persistiert pro Domain serverseitig.
- **Ignore-Liste in der Extension** — UI-only, ein einzelner Match wird per
  Item-Eye-Off-Button via `useIgnoreList` (siehe
  [docs/ui-components.md](../../../../../docs/ui-components.md#useignorelist--ignorieren-von-issues))
  ausgeblendet, mit optionaler Notiz. Bleibt clientseitig.

`SPELL_IGNORE_ADD` ist ein zusätzlicher serverseitiger Ignore-Endpoint, der
einen Text dauerhaft auf Backend-Ebene ausblendet — wird derzeit nicht aus
der UI getriggert, der Endpoint ist aber durch das Backend bereit.

## Settings-View (`views/SettingsView.vue`)

Erlaubt dem Mitarbeiter:

1. **Ignore-Wörter** (lokal) — Spellcheck-Treffer mit diesem Wort als
   `fehler` werden gefiltert. Wird in `useModuleSettings` persistiert
   (`spellcheck.ignoreWords: string[]`) und im Page-Kontext via
   `window.__moduleSettings.spellcheck.ignoreWords` gelesen.

Das Backend-Wörterbuch (`/dictionary`) ist **noch nicht** über die UI
editierbar — das ist ein Follow-up.

## Bekannte Stolperfallen

- **Dynamische Pages (React/Vue/Angular)**: Wenn die Seite nach unserem
  Check neu rendert, verschwinden unsere Spans. Lösung: Recheck-Button im
  Modul-Header drücken.
- **Lange Seiten (>10 000 Zeichen)**: Die Backend-Antwort kann mehrere
  Sekunden brauchen. `runningMessage` zeigt das im UI an.
- **Unicode-Edge-Cases**: LanguageTool zählt in UTF-16 Code-Units. Emojis
  oder Surrogate-Paare können zu Off-by-One führen. Falls ein Match nicht
  am korrekten Wort sitzt, kommt der Fallback (Strategie 3/4) zum Einsatz.
- **CMS4-Live-Editor**: Wenn der LE für die Domain offen ist, springt der
  Stift auf jedem Item zum entsprechenden Element im LE-Iframe (über
  `_meta.contextText`/`fehler`). Siehe
  [docs/live-editor.md](../../../../../docs/live-editor.md).

## Voraussetzungen für lokales Testen

- Backend muss laufen: `cd backend && npm run dev`
- `.env` des Backends:
  - `LANGUAGETOOL_URL` — URL zum LanguageTool-Server (intern oder
    api.languagetoolplus.com)
  - `LANGUAGETOOL_KEY` (optional) — falls Premium-Account
- Spellcheck-Datenbank initialisiert (`npm run db:migrate` o.ä. — bitte
  aktuelle Backend-README prüfen)

## Service-Worker-Message-Types (`background.js`)

| Type | Body | Antwort |
|---|---|---|
| `CHECK_SPELLING` | `{ text, url, language, domain, images }` | `{ matches: [...] }` |
| `SPELL_DICT_ADD` | `{ domain, word }` | Persistierter Eintrag |
| `SPELL_DICT_DELETE` | `{ id }` | `{ success: true }` |
| `SPELL_IGNORE_ADD` | `{ domain, error_text }` | Persistierter Eintrag |

Für UI-Erweiterungen (z.B. Domain-Wörterbuch im Settings-Tab editieren)
bestehen die Endpoints — nur die Vue-Bindung fehlt noch.
