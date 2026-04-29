# Validation-Modul (HTMLHint)

HTML-Linting via [HTMLHint](https://htmlhint.com/) — pure JS, läuft
komplett in der Extension ohne API-Call ans Backend.

## Was geprüft wird

HTMLHint ist ein Linter, kein W3C-Validator — fängt aber die häufigsten
real-world Issues. Standard-Ruleset (in `background.js` konfigurierbar):

### Doctype & Charset
- `doctype-first` — Dokument muss mit `<!DOCTYPE>` starten
- `doctype-html5` — Doctype muss HTML5 sein

### Tag/Attr-Formatting
- `tagname-lowercase` — `<DIV>` → `<div>`
- `tagname-specialchars` — keine ungültigen Zeichen in Tag-Namen
- `attr-lowercase` — `<a HREF="">` → `<a href="">`
- `attr-value-double-quotes` — `<a href=foo>` → `<a href="foo">`
- `attr-no-duplication` — `<a class="x" class="y">` → Fehler
- `attr-no-unnecessary-whitespace` — `<a href = "x">` → Warning
- `attr-unsafe-chars` — Sonderzeichen in Attributwerten

### Tag-Struktur
- `tag-pair` — alle Tags müssen geschlossen sein
- `spec-char-escape` — Sonderzeichen wie `<`, `>` müssen escaped sein

### Style/Script (informativ)
- `inline-style-disabled` — Warning bei `style="..."` Attributen
- `inline-script-disabled` — Warning bei inline `onclick="..."` etc.

### Eindeutigkeit
- `id-unique` — keine doppelten IDs

### Bewusst aus (von anderen Modulen abgedeckt)
- `alt-require` — siehe `images`-Modul
- `title-require` — siehe `overview`-Modul
- `tag-self-close` — Void-Elements ohne `/>` sind valides HTML5

## Wo es läuft

100% browser-only:
1. Page-Checker holt `document.documentElement.outerHTML` (mit `<!DOCTYPE>`-Prefix)
2. Schickt via `runInBackground('VALIDATE_HTML', { html })` an den Service Worker
3. SW lädt HTMLHint (npm-bundle, ~30KB) und ruft `HTMLHint.verify(html, ruleset)`
4. Ergebnisse zurück an Page, formatieren als Items

Kein Backend, kein Netzwerk, kein API-Call. HTMLHint ist eval-frei und
funktioniert in Manifest-V3-Service-Workern.

## Element-Lookup

HTMLHint liefert **Zeile + Spalte** im HTML-Quelltext und das fehlerhafte
Snippet (`evidence`) — keine CSS-Selektoren. Items zielen pauschal auf
`document.documentElement`. User sieht Position + Snippet im Detail-Expand
und kann das im Editor finden.

## Item-Anzeige

- **Titel** = `Zeile X, Spalte Y`
- **Issue** = HTMLHint-Fehlermeldung
- **Details** = Regel-ID (z.B. `tag-pair`, `id-unique`)
- Expand → Regel, Position, Code-Snippet, Doku-Link zur Regel-Beschreibung

## Trade-off vs. W3C Nu Validator

| | HTMLHint (das hier) | W3C Nu Validator |
|---|---|---|
| **Ausführung** | Browser, kein Netzwerk | API/Backend nötig |
| **Coverage** | ~80% praktischer Issues | 100% HTML5-Spec |
| **ARIA-Validierung** | Nein | Ja |
| **Element-Permittierung** | Teilweise (tag-pair) | Vollständig |
| **Performance** | <100ms typisch | 1-3s (HTTP-Roundtrip) |
| **Privacy** | HTML verlässt Browser nicht | HTML geht zum Validator |

Für inhouse-Tagesgeschäft ist HTMLHint die pragmatische Wahl. Wenn ihr
mal extreme Spec-Strikt-Validation braucht, lässt sich das W3C-Nu-Pattern
über das Backend separat einbauen (Code dafür liegt git-historisch noch
in den ersten Validation-Commits).

## Einschränkungen

- HTMLHint sieht den **gerenderten DOM** (`outerHTML`), nicht den
  Server-HTML. Browser-Korrekturen (auto-close, normalisierte Attribute)
  sind dadurch schon angewendet.
- Element-Lookup ist Zeile/Spalte statt Selektor — keine Overlay-Badges
  möglich, deshalb `overlay = null`.
- Ruleset ist hart-codiert in `background.js`. Anpassungen brauchen
  Code-Änderungen.
- Bei sehr großen Pages (1000+ Findings) wird die Liste lang. Default-
  Filter ist `'issues'` — man sieht nur Errors/Warnings.
