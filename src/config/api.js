const isProd = import.meta.env.VITE_ENV === 'production'
const BACKEND = isProd
  ? import.meta.env.VITE_BACKEND_URL
  : import.meta.env.VITE_BACKEND_LOCAL

if (!BACKEND) {
  console.error(
    `[wwweBar] Backend-URL fehlt — ${isProd ? 'VITE_BACKEND_URL' : 'VITE_BACKEND_LOCAL'} in .env setzen.`
  )
}

export const API = {
  auth: {
    url: `${BACKEND}/api/auth`,
  },
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