# Spellcheck-Modul

Rechtschreib- und Grammatikprüfung via LanguageTool-API.

## Was geprüft wird

1. Durchwandert das DOM und extrahiert sichtbaren Text
2. Schickt den Text an den LanguageTool-Proxy des Backends
   (`runInBackground('CHECK_SPELLING', { text, domain, language, images })`)
3. Empfängt `matches` mit Offsets, Ersatzvorschlägen und Regel-IDs
4. Mapped jeden Match auf ein Item, wobei das Issue je nach Schweregrad der
   Regel als Error oder Warning auftaucht

## Element-Lookup via `_meta.selector`

Spellcheck **injiziert Spans** um falsch geschriebene Wörter, damit Nutzer sie
hervorheben können. Das injizierte Span trägt
`data-${prefix}-injected="spellcheck"` und eine eindeutige id.
`_meta = { selector: `[data-${prefix}-injected-id="${id}"]` }` zeigt direkt
auf das injizierte Span — kein Tag/idx-Walk nötig.

Das Framework räumt diese Spans bei `useModuleAttributes.remove()` auf, indem
es jedes Span zurück zu einem Textknoten unwrappt.

## Bild-Alt-Texte

Bild-Alt-Texte werden ebenfalls an LanguageTool geschickt (selten, aber
nützlich — Tippfehler in Alt-Texten sind häufig). Sie werden über ihren `src`
identifiziert, sodass Matches zurückgemappt werden können.

## Eigene UI

`Index.vue` gruppiert Items nach `category` (Rechtschreibung, Grammatik,
Stil, …) mit einem Dismissed-Counter pro Kategorie. Nutzer können einzelne
Matches via die `@ignore` / `@addWord`-Events auf `SpellItem` verwerfen.

## Service Worker (`background.js`)

Leitet die Anfrage an den `/api/spellcheck/check`-Endpoint des Backends weiter.
Das Backend kümmert sich um den eigentlichen LanguageTool-API-Aufruf (und
ergänzt das projekteigene Wörterbuch).

## Einschränkungen

- Setzt voraus, dass das Backend läuft und die `SPELLCHECK_*`-Env-Vars in der
  `.env` des Backends gesetzt sind.
- Lange Seiten (10k+ Zeichen) können mehrere Sekunden dauern — es gibt eine
  `runningMessage`, die den Nutzer warnt.
- Das Verwerfen eines Matches gilt nur pro Session (nicht persistiert).
- Die injizierten Spans verändern das DOM. Seiten, die via React/Vue/Angular
  neu rendern, können sie überschreiben; nach solchem Re-Rendering erneut prüfen.
