# Headings-Modul

Hierarchie- und Inhaltsprüfungen für `<h1>` bis `<h6>`.

## Was geprüft wird

- **Fehlende H1** — Fehler, wenn keine `<h1>` auf der Seite vorhanden ist
- **Leere Heading** — Fehler, wenn eine Heading keinen Textinhalt hat
- **Doppelte H1** — Fehler bei mehr als einer `<h1>` (für manche Seiten passt
  eine Warning besser; hier ist es ein Fehler)
- **Heading-vor-H1** — Warning, wenn die erste Heading keine `<h1>` ist
- **Übersprungene Levels** — Warning, wenn die Hierarchie springt (z.B. H2 → H4)

Jede Heading bekommt zusätzlich eine `success`-Zeile mit Level und Text, sodass
der Nutzer die volle Hierarchie sieht, wenn der Filter "Alle anzeigen" ist.

## Overlay

Toggle "Tags ausblenden / einblenden" — zeigt den Tag-Namen jeder Heading
(H1, H2, …) als farbiges Badge über dem Element auf der Seite. Klicke auf ein
Badge, um zum passenden Item in der Sidebar zu springen.

## Element-Lookup

`_meta = { tag: 'H1', idx: <document-position> }`. Das `idx` ist die Position
innerhalb aller Elemente dieses Tags, nicht innerhalb des Headings-Arrays —
sodass Overlay-Lookup via `document.querySelectorAll('H1')[idx]` funktioniert.

## Eigene Anzeige

`Index.vue` zeigt einen `HeadingStats`-Block (Heading-Anzahl pro Level) über
den Standard-ModuleStats. Nutzt den Slot von `<ModulePage>`, um das
Standard-Items-Rendering zu überschreiben.
