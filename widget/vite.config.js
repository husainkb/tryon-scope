import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// Builds straight into the theme app extension's assets/ folder so
// `shopify app dev`/`deploy` can ship it with no extra build step of
// their own (theme extensions have no build hook; the file must already
// exist on disk). CSS is inlined into the JS so the Liquid block only
// needs a single <script> tag.
export default defineConfig({
  plugins: [react(), cssInjectedByJsPlugin()],
  // Don't copy widget/public/* (dev-preview favicon etc.) into the shared
  // theme-extension assets/ folder — only the JS bundle belongs there.
  publicDir: false,
  build: {
    outDir: '../extensions/theme-extension/assets',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'tryon-widget.js',
        chunkFileNames: 'tryon-widget-[hash].js',
        assetFileNames: 'tryon-widget-[name][extname]',
      },
    },
  },
})
