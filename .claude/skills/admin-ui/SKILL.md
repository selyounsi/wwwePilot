---
name: admin-ui
description: Build or extend an admin-backend page in the extension (src/admin/modules/) — module.json routing, RBAC gating, the shared-composable fetch pattern, DataTable/BaseModal/FormField usage.
---

# Admin UI page workflow

Location: `extension/src/admin/modules/<key>/`.
Reference implementation: `admin/modules/groups/` — copy its shape.

## Module anatomy (auto-discovered by src/admin/routes.js)

```
admin/modules/<key>/
  module.json                    ← key, permission, nav, routes
  views/Index.vue                ← resolved by convention: view "Index" → views/Index.vue
  views/<Detail>.vue             ← more views as needed
  composables/useAdmin<X>.js     ← shared reactive store + CRUD via apiJson
  translations/translations.json ← module strings
```

`module.json` (real example):

```json
{
  "key":        "groups",
  "enabled":    true,
  "permission": "admin.groups.read",
  "nav":    { "order": 45, "icon": "mdiAccountGroupOutline", "label": "Groups" },
  "routes": [
    { "path": "groups",     "name": "admin-groups",       "view": "Index" },
    { "path": "groups/:id", "name": "admin-group-detail", "view": "GroupDetail" }
  ]
}
```

- Routes mount under `/admin/*`; permission gating is meta-driven
  (`meta.requiresPermission`, fallback = module `permission`) and
  enforced by the global router guard. `nav.group` can reference
  `adminNavGroups` (webchecker / chatbot / api) for collapsible sections.
- In-template gating: `const { has } = usePermissions()` →
  `v-if="has('admin.groups.write')"`.

## Composable pattern (module-scoped, shared reactive state)

```js
import { reactive } from 'vue'
import { apiJson } from '@/composables/auth/apiClient.js'
import { API }     from '@/config/api.js'

const BASE = `${API.admin.url}/groups`
const state = reactive({ groups: [], current: null, loading: false, busy: false, error: null })

async function fetchAll() {
  state.loading = true; state.error = null
  try { state.groups = (await apiJson(BASE)).groups ?? [] }
  catch (e) { state.error = e.message }
  finally { state.loading = false }
}
async function create(payload) {
  state.busy = true
  try { const { group } = await apiJson(BASE, { method: 'POST', body: JSON.stringify(payload) }); await fetchAll(); return group }
  finally { state.busy = false }
}
export function useAdminGroups() { return { state, fetchAll, create /* … */ } }
```

`apiJson` throws on !ok with a friendly message (server `message` →
flattened Zod `issues` → `error` → HTTP status); `err.status` and
`err.data` are attached — branch on `e.status === 409` etc. Auth
header + refresh-retry are automatic. New backend endpoints need an
entry in `src/config/api.js#API` first.

## UI components (globally auto-registered — never raw-Tailwind these)

```vue
<DataTable
  :rows="state.groups" :columns="columns"
  :loading="state.loading" :error="state.error"
  :on-row-click="openDetail" :row-key="g => g.id"
  :empty-text="t('No groups yet.')" min-width="700px"
>
  <template #cell-name="{ row }">…</template>
  <template #cell-members="{ row }"><CellNumber :value="row.memberCount" muted-when="== 0" /></template>
  <template #cell-created="{ row }"><CellTimestamp :value="row.createdAt" mode="relative" /></template>
  <template #row-actions="{ row }"><BaseButton variant="icon-error" icon="mdiDelete" …/></template>
</DataTable>
```

- `columns = [{ key, label, minWidth, align? }]`
- Modal: `<BaseModal :open="x" size="md" :title="…" @update:open="x = $event">`
  with a `#footer` template for buttons.
- Fields: `<FormField v-model>`, `<TextareaField>`, `<SelectField>`,
  `<CheckboxField>`; primary button styling:
  `class="bg-primary! border-primary! text-black/80!"`.
- ALL status/severity/… pill color maps live in `CellBadge.vue`.
- Toasts: `useToast()` → `toast.success(t('…'))` / `toast.error(e.message)`.
- Docs: `extension/docs/ui-data-table.md`, `ui-forms.md`, `ui-components.md`.

## i18n

`const { t } = useI18n()` — keys are English strings; German goes in
the module's `translations/translations.json`
(`{ "de": { "Key": "Übersetzung" }, "en": {} }`). Admin-module
translation files are auto-globbed.

## Docs first — most answers live there

| Frage | Doc |
|---|---|
| DataTable + Zell-Helper (Badges, Farben) | [docs/ui-data-table.md](../../../docs/ui-data-table.md) |
| FormField / Modal / Cards / KPI / Tabs | [docs/ui-forms.md](../../../docs/ui-forms.md) |
| Globale UI-Bausteine (Übersicht) | [docs/ui-components.md](../../../docs/ui-components.md) |
| Bestehende Admin-Seiten (Referenzliste) | [docs/admin-modules.md](../../../docs/admin-modules.md) |
| Power-Tools-Seite | [docs/admin-power-tools.md](../../../docs/admin-power-tools.md) |
| Spellcheck-Verwaltung | [docs/admin-spellcheck.md](../../../docs/admin-spellcheck.md) |
| Gruppen + Sichtbarkeits-Filterung (3 Dimensionen, OR) | [docs/groups.md](../../../docs/groups.md) |
| Reports-Workflow | [docs/reports.md](../../../docs/reports.md) |
| Quick-Info (Service + Admin-Seite) | [docs/quick-info.md](../../../docs/quick-info.md) |
| Check-Types (Profile + manuelle Tasks) | [docs/check-types.md](../../../docs/check-types.md) |

## Checklist

1. Backend endpoint exists? (else `backend-service` skill first)
2. module.json + views + composable per the pattern above.
3. Permission gating: route meta AND `has()` for write actions.
4. Strings through `t()` + translations.json.
5. Bump `manifest.json#version`, doc update, live-test (`ship-change`,
   `extension-live-test`).
