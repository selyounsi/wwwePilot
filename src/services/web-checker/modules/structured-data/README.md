# Structured-Data-Modul

Erkennt und inspiziert JSON-LD-Schema-Markup auf der Seite und spiegelt dabei,
wie Googles Rich Results Test Findings gruppiert.

## Was geprüft wird

1. Durchwandert alle `<script type="application/ld+json">`-Tags
2. Flacht den JSON-Baum rekursiv ab, inklusive:
   - `@graph`-Containern
   - Top-Level-Arrays
   - verschachtelten Entitäten wie `review[]` innerhalb eines LocalBusiness
3. Filtert auf **rich-result-relevante `@type`s** (LocalBusiness, Review,
   AggregateRating, Article, Product, Event, FAQPage usw.) — Hilfstypen
   wie `PostalAddress`, `GeoCoordinates`, `Rating` werden übersprungen
4. Gruppiert Entitäten nach primärem `@type` — ein Item pro Type mit Counter
5. Pro Entität: validiert die `image`-URL — Erreichbarkeit + Dimensionsprüfung
   (z.B. `social_branding.png` sollte ≥ 250×250 sein)

## Warum gruppiert, nicht flach

Googles Rich Results Test zeigt "LocalBusiness: 2 Elemente", nicht zwei
separate Einträge. Wir spiegeln das. Die Expand-View jeder Gruppe drillt in
die einzelnen Entitäten herunter (klickbare Sub-Collapsibles).

## Bild-Erreichbarkeit

Nutzt `<img>`-Probes (nicht `fetch()`), damit Cross-Origin-Bilder ohne
CORS-Header nicht fälschlich fehlschlagen. `naturalWidth/Height` ist so oder
so lesbar.

## Warum `RICH_RESULT_TYPES` innerhalb von `check()` lebt

`chrome.scripting.executeScript` serialisiert nur den Funktionskörper — jede
Konstante auf Modulebene wäre im Page-Kontext `undefined`. Das Set muss
innerhalb von `check()` deklariert sein, um dort verfügbar zu sein.

## Einschränkungen

- Wir verfolgen keine Schema.org-Vererbung — `LocalBusiness` wird nicht
  zusätzlich als `Organization` gemeldet, wie Google es macht. Gleiches
  physisches Schema, eine Klassifikation.
- Person-Entitäten sind absichtlich **nicht** in der Whitelist. Sie würden
  als Duplikate des Authors jedes Reviews auftauchen.
- Wir lesen keine Pixel von Bg-Images für die Bild-Validierung; nur die
  URL-Erreichbarkeit und natürliche Größe.
