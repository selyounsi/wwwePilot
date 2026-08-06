# Claude-API-Key einrichten (für Mitarbeitende)

Der KI-Assistent „Claude" und alle Claude-Aktionen im Web-Checker (Alt-Texte,
Meta-Descriptions, H1-Vorschläge, DSGVO-Hinweise, Site-Report, CMS4-Tools)
brauchen einen eigenen API-Key von Anthropic. Ohne Key sind die Claude-Buttons
ausgeblendet — die Extension funktioniert ansonsten normal weiter.

Die Anleitung steht auch **direkt in der Extension**: Side Panel → KI-Assistent
→ Claude → Zahnrad → „Wie komme ich an einen API-Key?".

## Warum ein eigener Key?

Anthropic erlaubt Dritt-Anwendungen ausdrücklich **nicht**, einen
„Mit Claude-Account anmelden"-Login anzubieten oder Anfragen über
Abo-Zugänge (Free/Pro/Max) der Nutzer zu leiten. Es gibt für Endnutzer auch
keinen OAuth-Login in der API — unterstützt sind nur API-Key, Workload
Identity Federation und App Attest, und keine dieser Methoden trägt eine
Nutzer-Identität. Deshalb: pro Person ein eigener API-Key.

> Der EverWise-SSO-Login hilft hier nicht weiter: Er weist dich gegenüber
> **unserem** Backend aus. Anthropic kennt unsere Mitarbeitenden nicht, kann
> den Login also nicht als Authentifizierung akzeptieren.

## Schritt für Schritt

1. **Account anlegen** auf [platform.claude.com](https://platform.claude.com)
   — mit der Arbeits-E-Mail. Wer dort schon einen Account hat, meldet sich an.
2. **Guthaben aufladen** unter „Billing". Ohne Guthaben lässt sich ein Key
   erstellen, aber jede Anfrage schlägt fehl.
3. **Key erstellen** unter „Settings → API keys" →
   [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)
   → „Create Key".
4. **Name vergeben**, der später wiedererkennbar ist, z. B.
   „EverWise Extension".
5. **Key kopieren** — er wird **nur einmal** angezeigt.
6. In der Extension einfügen: Side Panel → KI-Assistent → Claude → Zahnrad →
   Feld „API-Key eingeben" → **Speichern & testen**. Die Extension prüft den
   Key sofort gegen Anthropic; erst danach erscheinen die Claude-Funktionen.

## Wichtig zu wissen

- **Ein Pro-/Max-Abo deckt die API nicht ab.** API-Nutzung wird getrennt
  abgerechnet — ein Abo für claude.ai bringt kein API-Guthaben mit.
- **Der Key bleibt lokal.** Er liegt in `chrome.storage.local` dieses Profils
  und wird ausschließlich an Anthropic gesendet, nie an unser Backend.
- **Kosten entstehen pro Anfrage.** Das Modell und die Token-Limits setzt das
  Backend zentral (`/api/config/mcp`), nicht der Client — Anpassungen brauchen
  also kein Extension-Update.
- **Key verloren?** Neuen erstellen und den alten in der Console löschen;
  anzeigen lässt sich ein bestehender Key nicht erneut.
- **Rechner-Wechsel:** Der Key wandert nicht mit. Entweder aus dem eigenen
  Passwortmanager erneut einfügen oder einen neuen erstellen.

## Ausblick

Wenn die Extension breiter ausgerollt wird, ist der saubere Weg **ein
Firmen-Key im Backend**: Die Extension würde dann über `/api/claude` gehen und
sich mit dem bestehenden SSO-Login legitimieren — niemand müsste mehr einen Key
anfassen, und die Abrechnung liefe zentral. Das setzt einen Firmen-Account bei
Anthropic voraus und ist bewusst noch nicht umgesetzt. Technische Details:
[chatbot-providers.md](./chatbot-providers.md).
