const BACKEND = import.meta.env.VITE_ENV === 'production'
  ? (import.meta.env.VITE_BACKEND_URL   ?? 'https://dein-server.de')
  : (import.meta.env.VITE_BACKEND_LOCAL ?? 'http://localhost:3000')

export const API = {
  chatbot: {
    url: `${BACKEND}/api/chatbot`,
  },
  spellcheck: {
    url: `${BACKEND}/api/spellcheck`,
  },
  pagespeed: {
    url: `${BACKEND}/api/pagespeed`,
  },
}