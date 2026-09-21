import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function inlineClassicScripts() {
  const read = (relativePath) =>
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

  /*
   * code.js defines window.RecipeBridge, which React reads at mount and which
   * the console testing aids drive. It is injected in dev as well as in the
   * build: skipping it there left the bridge undefined, so the control came up
   * with no way to reach its own entry points.
   *
   * Written as a <script src> in dev rather than inlined, so editing code.js
   * reloads rather than needing a restart. The build inlines it instead,
   * because the control ships as one file and a relative src does not resolve
   * under /screen_modules/.
   */
  const contract = (ctx) => (ctx?.server
    ? { tag: 'script', attrs: { 'data-webcc-contract': '', src: '/code.js' }, injectTo: 'head-prepend' }
    : { tag: 'script', attrs: { 'data-webcc-contract': '' }, children: read('./src/code.js'), injectTo: 'head-prepend' })

  return {
    name: 'inline-classic-scripts',
    transformIndexHtml(_html, ctx) {
      /*
       * The loader is build-only. It declares `var WebCC = ...` for the
       * container to hand a connection to, and in dev there is no container:
       * loading it would leave code.js waiting on a handshake that never
       * settles, so the UI would never render. Its absence is what makes
       * code.js take its standalone path.
       */
      if (ctx?.server) return [contract(ctx)]

      return [
        {
          tag: 'script',
          attrs: { 'data-webcc-loader': '' },
          children: read('./src/js/webcc.min.js'),
          injectTo: 'head-prepend',
        },
        contract(ctx),
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
