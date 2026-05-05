import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import fs from 'fs'
import manifest from './manifest.json' with { type: 'json' }

function copyAxe() {
  const src       = 'node_modules/axe-core/axe.min.js'
  const localeSrc = 'node_modules/axe-core/locales/de.json'
  if (!fs.existsSync(src)) {
    console.warn('⚠️ axe-core nicht installiert — accessibility-Modul wird nicht funktionieren')
    return
  }
  // copy to public/ so vite/crxjs auto-bundles it into dist/ root
  if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true })
  fs.copyFileSync(src, 'public/axe.min.js')
  if (fs.existsSync(localeSrc)) fs.copyFileSync(localeSrc, 'public/axe-locale-de.json')
  // also copy directly to dist/ if it already exists (covers post-build case)
  if (fs.existsSync('dist')) {
    fs.copyFileSync(src, 'dist/axe.min.js')
    if (fs.existsSync(localeSrc)) fs.copyFileSync(localeSrc, 'dist/axe-locale-de.json')
  }
}

export default defineConfig(({ mode }) => {
  const env     = loadEnv(mode, process.cwd(), '')
  const appName = env.VITE_APP_NAME

  return {
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/'),
    },
  },
  plugins: [
    tailwindcss(),
    vue(),
    crx({ manifest: { ...manifest, name: appName } }),
    {
      name: 'fix-manifest-permissions',
      closeBundle() {
        const distManifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf-8'))
        distManifest.permissions = ['sidePanel', 'scripting', 'tabs', 'activeTab', 'storage', 'webRequest', 'identity', 'cookies']
        distManifest.host_permissions = ['<all_urls>']
        fs.writeFileSync('dist/manifest.json', JSON.stringify(distManifest, null, 2))
        console.log('✅ Permissions in dist/manifest.json gefixt!')
      }
    },
    {
      name: 'copy-axe-core',
      configResolved() { copyAxe() },
      buildStart()     { copyAxe() },
      closeBundle()    { copyAxe() },
    }
  ],
  server: {
    cors: true,
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 5173 },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/htmlhint')) return 'vendor-htmlhint'
          if (id.includes('node_modules/@mdi'))     return 'vendor-mdi'
          if (id.includes('node_modules/vue') ||
              id.includes('node_modules/@vue'))     return 'vendor-vue'
          if (id.includes('node_modules'))          return 'vendor'
        },
      },
    },
  },
  }
})
