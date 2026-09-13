import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Inlines webcc.min.js and code.js as classic <script>s in <head>, in that
 * order, ahead of the React module bundle.
 *
 * Both must stay classic scripts. webcc.min.js declares `var WebCC = ...`,
 * which only reaches the global object from classic scope; code.js then calls
 * WebCC.start at top level, matching the MinTest / MinTestReact controls that work in this
 * project. Inlining (rather than <script src>) also keeps the build to a single
 * file, which the runtime needs since a relative src does not resolve under
 * /screen_modules/.
 */
function inlineClassicScripts() {
  const read = (rel) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  return {
    name: 'inline-classic-scripts',
    transformIndexHtml() {
      return [
        // Both use head-prepend, so they are emitted ahead of the React module
        // bundle. Vite keeps them in the order listed here, so the loader must
        // come first: it defines window.WebCC, which code.js calls immediately.
        {
          tag: 'script',
          attrs: { 'data-webcc-loader': '' },
          children: read('./src/js/webcc.min.js'),
          injectTo: 'head-prepend',
        },
        {
          tag: 'script',
          attrs: { 'data-webcc-contract': '' },
          children: read('./src/code.js'),
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [inlineClassicScripts(), react(), viteSingleFile()],
  build: {
    outDir: '../control',
    emptyOutDir: true,
  },
})
