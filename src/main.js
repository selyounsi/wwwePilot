import { createApp } from 'vue'
import './assets/css/style.css'
import App from './App.vue'
import router from './router/index.js'
import UI from './components/ui/index.js'
import { whenModuleSettingsHydrated }    from './composables/settings/useModuleSettings.js'
import { whenI18nHydrated }               from './composables/i18n/useI18n.js'
import { whenWebCheckerSettingsHydrated } from './services/web-checker/composables/useWebCheckerSettings.js'

;(async () => {
  await Promise.all([
    whenModuleSettingsHydrated(),
    whenI18nHydrated(),
    whenWebCheckerSettingsHydrated(),
  ])

  const app = createApp(App)
  app.use(router)
  app.use(UI)
  app.mount('#app')
})()
