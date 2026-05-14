import { reactive, computed } from 'vue'
import { apiJson } from './auth/apiClient.js'
import { useAuth } from './auth/useAuth.js'
import { API }     from '@/config/api.js'

const cache = reactive({
  byOrigin: {},   // origin → { notes: [...], loadedAt: number }
})

async function ensureLoaded(origin, { force = false } = {}) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value || !origin) return []
  const existing = cache.byOrigin[origin]
  if (!force && existing && Date.now() - existing.loadedAt < 30_000) return existing.notes

  try {
    const data = await apiJson(`${API.notes.url}?origin=${encodeURIComponent(origin)}`)
    cache.byOrigin[origin] = { notes: data.notes ?? [], loadedAt: Date.now() }
    return cache.byOrigin[origin].notes
  } catch (e) {
    console.warn('[notes] load failed:', e.message)
    return []
  }
}

async function createNote({ origin, scopePath, moduleId, issueHash, content }) {
  const { note } = await apiJson(`${API.notes.url}`, {
    method: 'POST',
    body:   JSON.stringify({ origin, scopePath, moduleId, issueHash, content }),
  })
  const bucket = cache.byOrigin[origin] ??= { notes: [], loadedAt: Date.now() }
  bucket.notes = [note, ...bucket.notes]
  return note
}

async function updateNote(id, patch) {
  const { note } = await apiJson(`${API.notes.url}/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  })
  const bucket = cache.byOrigin[note.origin]
  if (bucket) {
    const i = bucket.notes.findIndex(n => n.id === id)
    if (i >= 0) bucket.notes[i] = note
  }
  return note
}

async function deleteNote(id, origin) {
  await apiJson(`${API.notes.url}/${id}`, { method: 'DELETE' })
  const bucket = cache.byOrigin[origin]
  if (bucket) bucket.notes = bucket.notes.filter(n => n.id !== id)
}

export function useSiteNotes(originRef) {
  const notesForOrigin = computed(() => {
    const o = typeof originRef === 'function' ? originRef() : originRef?.value ?? originRef
    if (!o) return []
    return cache.byOrigin[o]?.notes ?? []
  })

  function activeFor({ origin, scopePath = null, moduleId = null, issueHash = null }) {
    const all = cache.byOrigin[origin]?.notes ?? []
    return all.filter(n => {
      if (n.resolvedAt) return false
      if (n.issueHash && issueHash) return n.issueHash === issueHash
      if (n.issueHash && !issueHash) return false
      if (n.moduleId && moduleId !== n.moduleId) return false
      if (n.scopePath && scopePath !== n.scopePath) return false
      return true
    })
  }

  return {
    cache,
    notesForOrigin,
    ensureLoaded,
    createNote,
    updateNote,
    deleteNote,
    activeFor,
  }
}
