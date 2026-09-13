import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function inlineClassicScripts() {
  const read = (relativePath) =>
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

  return {
    name: 'inline-classic-scripts',
    transformIndexHtml() {
      return [
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
