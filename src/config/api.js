import { APP_NAME } from './app.js'

const isProd = import.meta.env.VITE_ENV === 'production'
const BACKEND = isProd
  ? import.meta.env.VITE_BACKEND_URL
  : import.meta.env.VITE_BACKEND_LOCAL

if (!BACKEND) {
  console.error(
    `[${APP_NAME}] Backend-URL fehlt — ${isProd ? 'VITE_BACKEND_URL' : 'VITE_BACKEND_LOCAL'} in .env setzen.`
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
  config: {
    url: `${BACKEND}/api/config`,
  },
  version: {
    url: `${BACKEND}/api/version`,
  },
  activity: {
    url: `${BACKEND}/api/activity`,
  },
  runs: {
    url: `${BACKEND}/api/runs`,
  },
  notes: {
    url: `${BACKEND}/api/notes`,
  },
  reports: {
    url: `${BACKEND}/api/reports`,
  },
  checkTypes: {
    url: `${BACKEND}/api/check-types`,
  },
  quickInfo: {
    url: `${BACKEND}/api/quick-info`,
  },
  quickLinks: {
    url: `${BACKEND}/api/quick-links`,
  },
  admin: {
    url: `${BACKEND}/api/admin`,
  },
}