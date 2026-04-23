import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import fs from 'fs'
import manifest from './manifest.json' with { type: 'json' }

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/'),
    },
  },
  plugins: [
    tailwindcss(),
    vue(),
    crx({ manifest }),
    {
      name: 'fix-manifest-permissions',
      closeBundle() {
        const distManifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf-8'))
        distManifest.permissions = ['sidePanel', 'scripting', 'tabs', 'activeTab', 'storage']
        distManifest.host_permissions = ['<all_urls>']
        fs.writeFileSync('dist/manifest.json', JSON.stringify(distManifest, null, 2))
        console.log('✅ Permissions in dist/manifest.json gefixt!')
      }
    }
  ],
  server: {
    cors: true,
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 5173 },
  },
})
