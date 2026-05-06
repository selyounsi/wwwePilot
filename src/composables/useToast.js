import { reactive } from 'vue'

const state = reactive({ toasts: [] })
let nextId = 1

function push(type, message, opts = {}) {
  const id = nextId++
  const duration = opts.duration ?? (type === 'error' ? 6000 : 3500)
  state.toasts.push({
    id,
    type,
    message,
    title: opts.title ?? null,
  })
  if (duration > 0) setTimeout(() => dismiss(id), duration)
  return id
}

function dismiss(id) {
  const i = state.toasts.findIndex(t => t.id === id)
  if (i >= 0) state.toasts.splice(i, 1)
}

function clear() {
  state.toasts.splice(0)
}

export function useToast() {
  return {
    state,
    dismiss,
    clear,
    info:    (message, opts) => push('info',    message, opts),
    success: (message, opts) => push('success', message, opts),
    warning: (message, opts) => push('warning', message, opts),
    error:   (message, opts) => push('error',   message, opts),
  }
}
