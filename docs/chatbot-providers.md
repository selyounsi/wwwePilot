# Chatbot-Provider

Die Chat-Service-Architektur erlaubt mehrere Provider parallel (aktuell `wwwe`
und `claude`). Jeder Provider lebt unter
`src/services/chatbot/modules/<id>/` und folgt dem Provider-Modul-Vertrag in
[module-api.md](./module-api.md#chatbot-provider-modul).

## Provider an-/ausschalten

Pro User persistiert in `chrome.storage.local` unter Schlüssel
`wp-chatbot-providers:<userId>`. Default: alle Provider aus `module.json` mit
`active: true` sind global aktiv, der User kann sie individuell deaktivieren.

UI: **Settings → Chat → Aktive Chatbots**. Pro Provider ein Toggle. Wenn alle
Provider deaktiviert sind, zeigt der Chat-Tab eine Empty-State mit
„Chat-Einstellungen öffnen"-Button.

### Composable

```js
import { useChatbotProviders } from '@/services/chatbot/composables/useChatbotProviders.js'

const {
  modules,         // alle in module.json registrierten Provider
  enabledModules,  // computed: nur die vom User aktivierten
  anyEnabled,      // computed: true wenn mindestens einer aktiv
  isEnabled,       // (id) => boolean
  setEnabled,      // (id, bool) => void
} = useChatbotProviders()
```

Der Provider-Switcher (`ProviderToggle.vue`) blendet sich automatisch aus, wenn
nur ein Provider aktiv ist — kein nutzloser Button.

### Hydration

`whenChatbotProvidersHydrated()` wird in [main.js](../src/main.js) abgewartet,
bevor die App mountet — sonst rendert der Chat mit dem falschen
Default-Provider.

## Auswirkungen auf andere UI-Stellen

- **`<ClaudeButton>`** prüft `isEnabled('claude')` über `useClaude` und rendert
  nur wenn Claude vom User aktiviert ist. Siehe [claude-actions.md](./claude-actions.md).
- **„Im Chat analysieren"-Buttons** auf Web-Checker-Items zeigen nur, wenn
  `anyEnabled === true` (= mindestens ein Provider aktiv).
- **Module-Konfig** kann Chatbot-Buttons modul-weise abschalten via
  [`actions.chatbot: false`](./module-api.md#modulejson) im jeweiligen
  `module.json`.
