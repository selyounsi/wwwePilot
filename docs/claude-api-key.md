# Claude-API-Schlüssel einrichten (für Mitarbeitende)

Der KI-Assistent „Claude" und alle Claude-Aktionen im Web-Checker (Alt-Texte,
Meta-Descriptions, H1-Vorschläge, DSGVO-Hinweise, Site-Report, CMS4-Tools)
brauchen einen API-Schlüssel. Ohne Schlüssel sind die Claude-Buttons
ausgeblendet — die Extension funktioniert ansonsten normal weiter.

**Gute Nachricht:** Wir haben eine Firmen-Organisation bei Anthropic
(*wwwe GmbH*, API-Plan) mit SSO. Du brauchst also **keinen privaten Account und
kein privates Zahlungsmittel** — nur einen eigenen Schlüssel innerhalb der
Firmen-Organisation.

Die Kurzfassung steht auch **in der Extension**: Side Panel → KI-Assistent →
Claude → Zahnrad → „Wie komme ich an einen API-Key?".

## Schritt für Schritt

1. **Anmelden** auf [platform.claude.com](https://platform.claude.com) — per
   **SSO** mit dem Firmen-Account (`@wwwe.de`).
2. **Organisation prüfen:** Im Account-Menü unten links muss **wwwe GmbH**
   ausgewählt sein (mit Häkchen). Steht dort etwas anderes, umschalten — sonst
   landet der Schlüssel in einer privaten Organisation und die Nutzung wird
   nicht über die Firma abgerechnet.
3. **Zu den Schlüsseln:** „Organisationseinstellungen" → **API-Schlüssel**
   (Direktlink: [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)).
4. **Schlüssel erstellen** (Button oben rechts: **„+ Schlüssel erstellen"**).
5. **Arbeitsbereich: `Default`.** Die Liste zeigt zwei Einträge, *Default* und
   *Claude Code*. Für die Extension immer **Default** — *Claude Code* bleibt
   dem Terminal-Werkzeug vorbehalten. Der Arbeitsbereich entscheidet über
   Limits und Kostenzuordnung; so bleiben Extension- und Claude-Code-Verbrauch
   getrennt auswertbar.
6. **Namen vergeben**, der später wiedererkennbar ist, z. B.
   `everwise-extension-<dein-name>`.
7. **Schlüssel kopieren** — er wird **nur einmal** angezeigt. Danach zeigt die
   Console nur noch Anfang und Ende (`sk-ant-api03-…`).
8. **In der Extension einfügen:** Side Panel → KI-Assistent → Claude → Zahnrad
   → Feld „API-Key eingeben" → **Speichern & testen**. Die Extension prüft den
   Schlüssel sofort gegen Anthropic; erst danach erscheinen die
   Claude-Funktionen.

## Wichtig zu wissen

- **Der Schlüssel bleibt lokal.** Er liegt in `chrome.storage.local` dieses
  Browser-Profils und geht ausschließlich an Anthropic — nie an unser Backend.
- **Ein Schlüssel pro Person.** Nicht weitergeben: Schlüssel sind in der
  Console namentlich dem Ersteller zugeordnet, und genau das macht
  Verbrauch nachvollziehbar.
- **Schlüssel gehören zum Arbeitsbereich, nicht zur Person.** Die Console sagt
  das ausdrücklich: sie *„bleiben aktiv, auch nachdem der Ersteller entfernt
  wurde"*. Beim Ausscheiden also aktiv widerrufen, nicht nur den Account
  deaktivieren.
- **Verloren?** Neuen erstellen und den alten über das Drei-Punkte-Menü in der
  Liste löschen. Ein bestehender Schlüssel lässt sich nicht erneut anzeigen.
- **Rechner-Wechsel:** Der Schlüssel wandert nicht mit. Entweder aus dem
  Passwortmanager erneut einfügen oder einen neuen erstellen.
- **Modell und Token-Limits** setzt das Backend zentral über
  `/api/config/mcp` — Anpassungen brauchen kein Extension-Update.
- **Fehlermeldung wegen Guthaben/Limit?** Dann ist nicht dein Schlüssel das
  Problem, sondern das Budget bzw. Limit des Arbeitsbereichs
  („Organisationseinstellungen → Limits"). Melde dich bei der Person, die die
  Organisation verwaltet.

## „Ich habe doch schon einen Schlüssel für Claude Code"

Dann **trotzdem einen neuen für die Extension erstellen** — pro Werkzeug ein
eigener Schlüssel. Gründe:

- **Widerrufen ohne Kollateralschaden:** Ein geteilter Schlüssel lässt sich
  nicht für die Extension sperren, ohne gleichzeitig Claude Code lahmzulegen.
- **Verbrauch zuordnen:** Extension-Schlüssel in *Default*, Claude-Code-Schlüssel
  in *Claude Code* — dann zeigt die Console pro Arbeitsbereich, was welches
  Werkzeug verbraucht hat. Ein gemeinsamer Schlüssel vermischt das unauflösbar.

**Die Anzahl ist nicht begrenzt.** Dass in der Auswahlliste nur zwei Einträge
stehen, heißt nicht „maximal zwei Schlüssel" — das sind die beiden
**Arbeitsbereiche** der Organisation. Pro Arbeitsbereich lassen sich beliebig
viele Schlüssel anlegen. Neue Arbeitsbereiche anzulegen ist allerdings
Org-Admins vorbehalten.

Falls du einen bestehenden Schlüssel suchst: In VS Code kann er in der
`settings.json` unter `claudeCode.environmentVariables` als
`ANTHROPIC_API_KEY=…` stehen. **Das ist eher ein Grund zum Aufräumen als eine
Fundgrube:**

- Die Datei liegt im Klartext auf der Platte, und wenn **Settings Sync**
  aktiv ist, wird sie in dein Microsoft-Konto synchronisiert — der Schlüssel
  landet damit auf jedem Gerät, an dem du dich in VS Code anmeldest.
- Claude Code braucht diesen Eintrag normalerweise nicht: Ohne
  `ANTHROPIC_API_KEY` nutzt es die eigenen, sicher gespeicherten
  Anmeldedaten (Keychain bzw. `.credentials.json`).
- Ein gesetzter `ANTHROPIC_API_KEY` wird von Claude Code **bevorzugt** vor dem
  normalen Login benutzt. Wer sich wundert, über welchen Zugang abgerechnet
  wird: `/status` in Claude Code zeigt die aktive Auth-Methode.

Empfehlung: Eintrag entfernen, den betroffenen Schlüssel in der Console
widerrufen und für jedes Werkzeug einen frischen erstellen.

## Warum kein „Mit Claude anmelden"-Button?

Das ist die häufigste Rückfrage — und technisch nicht möglich:

- Anthropic erlaubt Dritt-Anwendungen **ausdrücklich nicht**, einen
  Claude.ai-Login anzubieten oder Anfragen über Abo-Zugänge (Free/Pro/Max)
  der Nutzer zu leiten.
- Die API kennt für Endnutzer **keinen OAuth-Login**. Unterstützt sind nur
  API-Schlüssel, Workload Identity Federation und App Attest — und keine
  dieser Methoden trägt eine Nutzer-Identität.
- Auch der **EverWise-SSO-Login hilft nicht**: Er weist dich gegenüber
  *unserem* Backend aus. Anthropic kennt unsere Mitarbeitenden nicht und kann
  diesen Login deshalb nicht als Authentifizierung akzeptieren.

Der SSO-Login bei Anthropic (Schritt 1) ist etwas anderes: Er ist der Login in
die **Console**, um dort einen Schlüssel zu erzeugen — nicht der Login der
Extension.

## Ausblick

Mittelfristig ist der sauberere Weg **ein Firmen-Schlüssel im Backend**: Die
Extension würde über `/api/claude` gehen und sich mit dem bestehenden
EverWise-SSO-Login legitimieren — dann müsste niemand mehr einen Schlüssel
anfassen, und die Abrechnung liefe zentral über einen einzigen Schlüssel.
Technische Details und Aufwand: [chatbot-providers.md](./chatbot-providers.md).
