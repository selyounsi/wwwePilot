# Check-Flow & Tab-Handling

Wie ein Web-Checker-Run angestoßen wird, welcher Tab geprüft wird, und wie
man zwischen Tabs wechselt ohne die Sidebar neu zu öffnen.

## Wer prüft wen

[`useWebChecker`](../src/services/web-checker/composables/useWebChecker.js)
hält den globalen Check-State und kennt zwei Tab-Begriffe:

| Begriff | Bedeutung |
|---|---|
| **Active tab** | Der gerade vom User sichtbare Browser-Tab (`chrome.tabs.query({active})`) |
| **Checked tab** | Der Tab, dessen Daten aktuell im Sidebar-State stehen (`state.checkedTabId`) |

Bei einem ersten Run sind beide identisch. Wenn der User danach in einen
anderen Tab wechselt, weichen sie auseinander — das Sidebar-Display zeigt
weiter die alten Daten, bis explizit neu geprüft wird.

## Tab-Status-Badge

`<TabStatusBadge>` im HomeView zeigt den Verhältnis-Status:

| Status | Bedeutung |
|---|---|
| `current` | Active = Checked, Daten sind aktuell |
| `url-changed` | gleicher Tab, aber URL hat sich geändert |
| `reloaded` | gleicher Tab + URL, aber gerade neu geladen |
| `different-tab` | User ist in anderem Tab — klickbar, switcht zurück |
| `editor-match` | Active ist der LE für die geprüfte Seite |
| `editor-page-mismatch` | LE offen, aber andere Page derselben Domain |
| `editor-domain-mismatch` | LE offen, andere Domain |
| `unchecked` | noch nichts geprüft |

## Re-Check auf anderem Tab

Damit der User die Extension nicht schließen muss, gibt es zwei
„auf-aktuellem-Tab-prüfen"-Buttons (Icon `mdiPlayCircleOutline`):

### Web-Checker Home

In der oberen Header-Zeile, rechts neben „Module":

```
Module                                       [▶]
● Geprüft: foobar-page              10:25:41
```

Klick → `runChecks()` ohne Argumente → läuft auf dem aktiven Tab und ersetzt
alle Modul-Resultate. Erscheint nur, wenn schon ein Check existiert
(`state.checkedTabId`).

### Modul-Detail (`<ModuleSection>`-Header)

Neben dem normalen Refresh-Button:

```
Modul-Name                     [⟳] [▶] [👁]
```

| Button | Aktion |
|---|---|
| ⟳ `mdiRefresh` | Re-check auf dem **ursprünglich geprüften** Tab (`state.checkedTabId`) |
| ▶ `mdiPlayCircleOutline` | Re-check auf dem **aktuell aktiven** Tab |
| 👁 Overlay-Toggle | Modul-spezifisch (z.B. Heading-Tags zeigen) |

Implementierung in `useModuleSetup.recheck({ activeTab: true })`:

```js
async function recheck({ activeTab = false } = {}) {
  let tabId
  if (activeTab) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    setCheckedTab(tab)
    tabId = tab.id
  } else {
    tabId = state.checkedTabId ?? (await activeTabFallback())
  }
  // … run checker on tabId
}
```

`setCheckedTab(tab)` aktualisiert `checkedTabId/Url/Name` — nach dem Run zeigt
das Sidebar-Display den neuen Tab als Quelle.

## Visibility-Tracking

[`useVisibilityWatcher`](../src/services/web-checker/composables/useVisibilityWatcher.js)
hält das `item.visible`-Flag aktuell, während der User auf der geprüften Seite
scrollt oder Layout-Veränderungen passieren.

| Event | Reaktion |
|---|---|
| Scroll im Top-Frame oder Iframe | Dirty-Flag → Recheck nach ≤ 400 ms |
| Resize | Dirty-Flag → Recheck |
| Tab aktiviert | Sofort-Recheck |
| Alle 5 s | Unconditional Recheck (Safety-Net für lazy iframes / overflow-Container) |

Die 5 s sind wichtig, weil:

- `scroll`-Events bubbeln nicht — Capture-Phase auf `document` fängt zwar
  Scroll-Container ab, aber neu erzeugte Iframes (CMS4 lazy-loaded) brauchen
  einen aktiven Listener-Inject.
- Der 5 s-Tick re-injiziert Listeners auf neue Iframes (idempotent über
  `WeakSet`-Tracking).

Beide Intervalle werden in `onUnmounted` aufgeräumt — kein CPU-Overhead
außerhalb der Modul-Detailansicht.
