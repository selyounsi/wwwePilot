export const APP_NAME       = import.meta.env.VITE_APP_NAME ?? 'App Name'
export const APP_NAME_LOWER = APP_NAME.toLowerCase()

if (!import.meta.env.VITE_APP_NAME) {
  console.error(`[${APP_NAME}] VITE_APP_NAME not set — extension identifier may collide with other extensions.`)
}
