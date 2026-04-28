if (!import.meta.env.VITE_APP_NAME) {
  console.error('[wwweBar] VITE_APP_NAME nicht gesetzt — Extension-Identifier kollidiert ggf. mit anderen Extensions.')
}

export const APP_NAME       = import.meta.env.VITE_APP_NAME ?? 'App Name'
export const APP_NAME_LOWER = APP_NAME.toLowerCase()
