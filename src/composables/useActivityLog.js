import { apiFetch } from './auth/apiClient.js'
import { useAuth }  from './auth/useAuth.js'
import { API }      from '@/config/api.js'

/**
 * Submit a user activity event to the backend. Fire-and-forget: never awaits
 * the response, never throws — log to console on failure but don't bother the
 * caller. The backend forces the user_id from the JWT so we don't pass it.
 *
 * Use sparingly with payloads — anything you'd be uncomfortable seeing in the
 * admin activity feed shouldn't go in.
 */
export function useActivityLog() {
  function record(type, target = null, payload = null) {
    const { isAuthenticated } = useAuth()
    if (!isAuthenticated.value) return

    apiFetch(`${API.activity.url}`, {
      method: 'POST',
      body:   JSON.stringify({ type, target, payload }),
    }).catch(e => {
      console.warn('[activity] record failed:', type, e.message)
    })
  }

  return { record }
}
