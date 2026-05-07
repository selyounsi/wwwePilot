import { createApp } from 'vue'
import './assets/css/style.css'
import App from './App.vue'
import router from './router/index.js'
import UI from './components/ui/index.js'
import { whenModuleSettingsHydrated }    from './composables/settings/useModuleSettings.js'
import { whenI18nHydrated }               from './composables/i18n/useI18n.js'
import { whenUiSettingsHydrated }         from './composables/settings/useUiSettings.js'
import { whenWebCheckerSettingsHydrated } from './services/web-checker/composables/useWebCheckerSettings.js'
import { whenAuthHydrated }               from './composables/auth/useAuth.js'
import { whenFavoritesHydrated }          from './composables/useFavorites.js'
import { whenChatbotProvidersHydrated }   from './services/chatbot/composables/useChatbotProviders.js'
import { whenAppConfigHydrated }           from './composables/useAppConfig.js'
import { whenExtensionVersionReady }       from './composables/useExtensionVersion.js'
import { whenExtensionPathHydrated }       from './composables/useExtensionPath.js'

;(async () => {
  await Promise.all([
    whenModuleSettingsHydrated(),
    whenI18nHydrated(),
    whenUiSettingsHydrated(),
    whenWebCheckerSettingsHydrated(),
    whenAuthHydrated(),
    whenFavoritesHydrated(),
    whenChatbotProvidersHydrated(),
    whenAppConfigHydrated(),
    whenExtensionVersionReady(),
    whenExtensionPathHydrated(),
  ])

  const app = createApp(App)
  app.use(router)
  app.use(UI)
  app.mount('#app')
})()
