/*
 * Writes the silo out as a standalone SVG file, for editing in an external
 * program (Inkscape, Illustrator, ...).
 *
 *   npm run export:silo            -> design/silo.svg
 *   npm run export:silo -- out.svg -> out.svg
 *
 * It renders the real Silo component rather than a hand-kept copy, so the
 * file is exactly what the control draws. Only the silo itself is written:
 * the icon row is interactive UI, hidden until clicked, and has no place in
 * a drawing.
 *
 * The file is a snapshot. Edits made to it do not flow back into Silo.jsx,
 * and re-running this overwrites them.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// The silo to draw. Kept in step with the defaults in App.jsx by hand: App
// holds them as React state, which a script cannot import.
const dim = {
  lines: 1,
  lineCount: 6,
  siloWidth: 80,
  h1: 120,
  h2: 25,
  h3: 30,
  h4: 30,
  w2: 20,
  labelGap: 10,
}
const look = {
  body: '#b6d600',
  roof: '#258c50',
  hopper: '#b6d600',
  outline: 'none',
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.resolve(projectRoot, process.argv[2] ?? 'design/silo.svg')

// Silo.jsx turns look's colours into #rrggbb with a canvas, which Node does
// not have. This stands in for the one thing it is used for - normalising a
// colour on assignment to fillStyle - for hex, rgb() and the named colours a
// silo is likely to be given. Anything else is left unchanged, which Silo
// reads as invalid and draws black, and is reported below.
const NAMED = {
  black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3', dimgray: '#696969',
  dimgrey: '#696969', slategray: '#708090', slategrey: '#708090',
  lightslategray: '#778899', lightslategrey: '#778899', gainsboro: '#dcdcdc',
  red: '#ff0000', darkred: '#8b0000', maroon: '#800000', orange: '#ffa500',
  yellow: '#ffff00', gold: '#ffd700', green: '#008000', lime: '#00ff00',
  darkgreen: '#006400', olive: '#808000', blue: '#0000ff', navy: '#000080',
  darkblue: '#00008b', steelblue: '#4682b4', lightsteelblue: '#b0c4de',
  teal: '#008080', aqua: '#00ffff', cyan: '#00ffff', purple: '#800080',
  fuchsia: '#ff00ff', magenta: '#ff00ff', brown: '#a52a2a', tan: '#d2b48c',
  beige: '#f5f5dc', wheat: '#f5deb3', khaki: '#f0e68c',
}
const unknown = new Set()
function normalise(colour) {
  const c = String(colour).trim().toLowerCase()
  if (NAMED[c]) return NAMED[c]
  if (/^#[0-9a-f]{6}$/.test(c)) return c
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${[...c.slice(1)].map((d) => d + d).join('')}`
  const rgb = c.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/)
  if (rgb) return `#${rgb.slice(1).map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
  unknown.add(colour)
  return null
}
globalThis.document = {
  createElement: () => ({
    getContext: () => {
      let fill = '#000000'
      return {
        get fillStyle() { return fill },
        set fillStyle(v) { fill = normalise(v) ?? fill },
      }
    },
  }),
}

// Vite loads the component the way the app does - JSX, its CSS import and
// all - without a build.
const server = await createServer({
  root: projectRoot,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})
try {
  const { default: Silo } = await server.ssrLoadModule('/src/components/element/Silo.jsx')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')

  // Top-left at the origin, so the file's canvas is exactly the silo.
  const silo = Silo({ dim: { ...dim, x: 0, y: 0, anchor: 'top-left' }, look, warnings: 0, title: process.env.SILO_TITLE ?? 'Cement', values: [{ value: '1234.56', unit: 'kg' }, { value: '987.65', unit: 'kg' }] })
  // The <svg> is rendered by React too, not wrapped round the markup after:
  // outside one, React does not know the elements are SVG - it warns about
  // <linearGradient>'s casing and hoists <title> out as a document title.
  const root = createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      // Room above the silo for its title, which is drawn over its top.
      width: silo.width,
      height: silo.height + silo.above,
      viewBox: `0 ${-silo.above} ${silo.width} ${silo.height + silo.above}`,
    },
    silo.element,
  )
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
${removeGroup(renderToStaticMarkup(root), 'silo-icons')}
`
  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, svg)
  console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${silo.width} x ${silo.height})`)
  if (unknown.size) {
    console.warn(`Not recognised, drawn black: ${[...unknown].join(', ')} - use #rrggbb in the script's look.`)
  }
} finally {
  await server.close()
}

// Cuts the <g class="..."> group out of the markup, nested groups and all:
// counts <g> opens against </g> closes to find the one that ends it.
function removeGroup(markup, className) {
  const start = markup.indexOf(`<g class="${className}"`)
  if (start < 0) return markup
  const tags = /<g[\s>]|<\/g>/g
  tags.lastIndex = start
  let depth = 0
  for (let m; (m = tags.exec(markup)); ) {
    depth += m[0] === '</g>' ? -1 : 1
    if (depth === 0) return markup.slice(0, start) + markup.slice(tags.lastIndex)
  }
  return markup
}
