import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import fs from 'fs'
import manifest from './manifest.json' with { type: 'json' }

// Generates a virtual module with only the MDI icons referenced anywhere in
// the source. Avoids the 2.8 MB cost of `import * as mdi from '@mdi/js'`
// without forcing developers to maintain an allowlist by hand.
function autoMdiIcons() {
  const VIRTUAL_ID = 'virtual:icons'
  const RESOLVED   = '\0' + VIRTUAL_ID

  function collectIcons() {
    const re = /mdi[A-Z][a-zA-Z0-9]*/g
    const icons = new Set()
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
          walk(p)
        } else if (/\.(vue|js|json)$/.test(entry.name)) {
          const text = fs.readFileSync(p, 'utf-8')
          const matches = text.match(re)
          if (matches) for (const m of matches) icons.add(m)
        }
      }
    }
    walk('src')
    return [...icons].sort()
  }

  return {
    name: 'auto-mdi-icons',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED
    },
    load(id) {
      if (id !== RESOLVED) return null
      const names = collectIcons()
      if (!names.length) return 'export const ICONS = {}'
      const list = names.join(', ')
      return `import { ${list} } from '@mdi/js'\nexport const ICONS = { ${list} }`
    },
    handleHotUpdate({ file, server }) {
      if (!/\.(vue|js|json)$/.test(file)) return
      const mod = server.moduleGraph.getModuleById(RESOLVED)
      if (mod) server.moduleGraph.invalidateModule(mod)
    },
  }
}

function copyAxe() {
  const src       = 'node_modules/axe-core/axe.min.js'
  const localeSrc = 'node_modules/axe-core/locales/de.json'
  if (!fs.existsSync(src)) {
    console.warn('axe-core not installed — accessibility module will not work')
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
    autoMdiIcons(),
    tailwindcss(),
    vue(),
    crx({ manifest: { ...manifest, name: appName } }),
    {
      name: 'fix-manifest-permissions',
      closeBundle() {
        const distManifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf-8'))
        distManifest.permissions = ['sidePanel', 'scripting', 'tabs', 'activeTab', 'storage', 'webRequest', 'identity', 'cookies', 'downloads']
        distManifest.host_permissions = ['<all_urls>']
        fs.writeFileSync('dist/manifest.json', JSON.stringify(distManifest, null, 2))
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
