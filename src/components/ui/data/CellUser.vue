<script setup>
import { computed } from 'vue'

/**
 * Render a user across the admin: name → email → shortened id, optionally
 * with avatar and a muted email subline. Accepts both camelCase (frontend
 * shape) and snake_case (raw DB row) keys so a `state.reports[i]` from a
 * SQL join can flow in unchanged via `:user="row"` plus an alias prop.
 *
 *  <CellUser :user="r" />                                  → "Jane Doe"
 *  <CellUser :user="r" show-avatar show-email />           → avatar + name + email
 *  <CellUser :user="r" prefix="assignee" :empty-label="t('Unassigned')" />
 */

const props = defineProps({
  user:        { type: Object, default: null },
  prefix:      { type: String, default: null },
  showAvatar:  { type: Boolean, default: false },
  showEmail:   { type: Boolean, default: false },
  size:        { type: Number, default: 24 },
  emptyLabel:  { type: String, default: '—' },
})

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null && v !== '') return v
  }
  return null
}

function p(field) {
  // Try `prefix_field`, `prefixField`, then bare `field`. Lets one row carry
  // multiple user shapes (e.g. reporter + assignee).
  const u = props.user
  if (!u) return null
  if (props.prefix) {
    const snake = `${props.prefix}_${field}`
    const camel = props.prefix + field[0].toUpperCase() + field.slice(1)
    const v = u[snake] ?? u[camel]
    if (v != null && v !== '') return v
  }
  return null
}

const firstName = computed(() => p('first_name') ?? p('firstName') ?? (props.prefix ? null : pick(props.user, 'first_name', 'firstName')))
const lastName  = computed(() => p('last_name')  ?? p('lastName')  ?? (props.prefix ? null : pick(props.user, 'last_name', 'lastName')))
const email     = computed(() => p('email')      ?? (props.prefix ? null : pick(props.user, 'email')))
const name      = computed(() => p('name')       ?? (props.prefix ? null : pick(props.user, 'name')))
const id        = computed(() => p('id')         ?? (props.prefix ? null : pick(props.user, 'id', 'user_id', 'userId')))

const hasAnyData = computed(() => firstName.value || lastName.value || email.value || name.value || id.value)

const label = computed(() => {
  if (firstName.value && lastName.value) return `${firstName.value} ${lastName.value}`
  if (name.value)  return name.value
  if (email.value) return email.value
  if (id.value)    return String(id.value).slice(0, 8)
  return null
})

const avatarUser = computed(() => ({
  id:        id.value,
  email:     email.value,
  name:      name.value,
  firstName: firstName.value,
  lastName:  lastName.value,
}))
</script>

<template>
  <div v-if="hasAnyData" class="inline-flex items-center gap-2 min-w-0">
    <UserAvatar v-if="showAvatar" :user="avatarUser" :size="size" />
    <div class="min-w-0">
      <div class="truncate">{{ label }}</div>
      <div v-if="showEmail && email && email !== label" class="text-[10px] text-muted truncate">{{ email }}</div>
    </div>
  </div>
  <span v-else class="text-muted/60 italic">{{ emptyLabel }}</span>
</template>
