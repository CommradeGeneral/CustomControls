/**
 * A silo's values, drawn straight on its body - no plate behind them: a line
 * per value, stacked and centred on the tank body, each its number (bold)
 * and unit (smaller, lighter). The first is required, the second served.
 *
 * A value is a string ('1234.56 kg') or { value, unit }.
 */

const ASCENT = 0.72 // capitals' height above the baseline, in font sizes
const INK = '#1f2933'
// A thin white ring round each letter, for the text to read over the drum's
// shading and seams without a plate behind it.
const HALO = { stroke: '#fff', strokeOpacity: 0.85, paintOrder: 'stroke', strokeLinejoin: 'round' }

// The reading's size, as a share of the silo's width: the largest used,
// shrunk only if the widest reading would not otherwise fit TEXT_WIDTH.
const FONT = 0.2
const TEXT_WIDTH = 0.9 // of the silo's width
const LINE = 1.3 // line spacing, in font sizes
const UNIT = 0.72 // the unit's size, of the number's
const UNIT_GAP = 0.2 // between number and unit, in font sizes

// A value as given, as { number, unit }.
export function readValue(entry) {
  if (entry === null || typeof entry !== 'object') {
    const text = String(entry ?? '').trim()
    const cut = text.lastIndexOf(' ')
    const [number, unit] = cut < 0 ? [text, ''] : [text.slice(0, cut), text.slice(cut + 1)]
    return { number, unit }
  }
  return { number: String(entry.value ?? ''), unit: entry.unit ?? '' }
}

/**
 * The values. `g` is the silo's geometry, in the body group's units: W (its
 * width), bodyTop and bodyBottom, look, and measure(text, bold, font).
 */
export function SiloValues({ readings, g }) {
  if (!readings.length) return null
  const { W, measure } = g

  // Full size, or smaller if the widest reading would overrun the space.
  const readingW = (r, f) => measure(r.number, true, f) + (r.unit ? f * UNIT_GAP + measure(r.unit, false, f * UNIT) : 0)
  const full = W * FONT
  const f = Math.min(full, full * ((W * TEXT_WIDTH) / Math.max(...readings.map((r) => readingW(r, full)))))
  const step = f * LINE
  // The stack centred on the tank body's middle - half-way between its top
  // rim and where it meets the cone.
  const mid = (g.bodyTop + g.bodyBottom) / 2

  return (
    <g className="silo-label" fontFamily="Arial, sans-serif" fontSize={f} fill={g.look.text ?? INK} textAnchor="middle">
      {readings.map((r, i) => (
        <text
          key={i}
          x={W / 2}
          y={mid - ((readings.length - 1) * step) / 2 + i * step + f * (ASCENT / 2)}
          strokeWidth={f * 0.2}
          style={{ ...HALO, fontVariantNumeric: 'tabular-nums' }}
        >
          <tspan fontWeight={700}>{r.number}</tspan>
          {r.unit && (
            <tspan dx={f * UNIT_GAP} fontSize={f * UNIT} fillOpacity="0.7">
              {r.unit}
            </tspan>
          )}
        </text>
      ))}
    </g>
  )
}
