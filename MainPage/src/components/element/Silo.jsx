import { useId, useState } from 'react'
import { Settings, TriangleAlert } from 'lucide-react'
import './Silo.css'

/**
 * The silo drawing, as an SVG group. Rendered through Silo() below, which
 * pairs it with its size.
 *
 * Draws a <g>, not an <svg>: the canvas belongs to whoever places the silo,
 * so several elements can share one <svg> and one coordinate system.
 *
 * Draws whatever `dim` and `look` it is given, so the container-driven values
 * stay in App. The only state here is whether the icon row is open, which
 * nothing outside the drawing needs.
 *
 *   dim   lines, lineCount (seam rings), siloWidth, h1 (body), h2 (fence), h3 / h4 (hopper cone and
 *         outlet), w2 (outlet width); x, y and anchor place it - see
 *         siloOrigin
 *   look  body, hopper - each part's base colour; roof - the fence's, as it
 *         stands where the roof was. Any CSS colour, shaded as plastic
 *         (PLASTIC); outline - the stroke,
 *         'none' to hide it
 *
 * A row of icons sits above the fence; clicking the silo shows or hides it -
 * all but the warning icon while `warnings` is above 0, which always shows
 * (Silo.css). Clicking an icon calls onIconClick with its name. `warnings` is
 * the count badged on the warning icon.
 * Clicking the silo itself also calls onSiloClick, if given, after toggling
 * the row; a click on an icon does not. Its space is reserved even when hidden, so the silo does not
 * jump when the row appears.
 */

// Placeholders until the row gets real actions. `name` is what onIconClick
// receives, so the caller decides what each one does.
const ICONS = [
  { name: 'warning', Icon: TriangleAlert },
  { name: 'settings', Icon: Settings },
]
const ICON_SIZE = 12
// The warning count's badge: a pill whose height is fixed and whose width
// follows the text - a circle for one digit, stretching for '+99' - so the
// number always fits inside it. Its vertical centre sits BADGE_Y below the
// icon's top edge, so part of it rises above the icon; the row is pushed down
// by half its height, which covers that at any BADGE_Y from 0 up.
const BADGE_H = 7
const BADGE_FONT = 5
// Roughly one digit's advance at BADGE_FONT, bold, plus the pill's side
// padding. Estimated rather than measured: getBBox would need a render pass
// and a ref for a few pixels of width.
const BADGE_CHAR = 3.1
const BADGE_PAD = 3
// Where the pill starts, from the icon's left edge: past the triangle's apex,
// so it grows rightwards over the icon's top-right corner and away from it.
const BADGE_X = ICON_SIZE - 5
const BADGE_Y = 2
// The row's height including the badge above and the gap down to the fence.
const ICON_ROW = BADGE_H / 2 + ICON_SIZE + 4

// The clear gap cut into the icon around the pill, so the triangle's lines
// stop short of it instead of touching it.
const BADGE_CUT = 1

// What the badge shows: nothing at 0 (or below), the count up to 99, and
// '+99' past that.
function badgeText(count) {
  if (!(count > 0)) return null
  return count > 99 ? '+99' : String(count)
}

function badgeWidth(text) {
  return Math.max(BADGE_H, text.length * BADGE_CHAR + BADGE_PAD)
}

// How far the outlet's rounded bottom - the front half of its circle, seen
// from above - dips below the outlet's straight sides.
function outletDip(dim) {
  return (dim.w2 / 2) * TILT
}

// The silo's own height, fence to the lowest point of the outlet - the icon
// row is not part of it.
function siloHeight(dim) {
  return dim.h2 + dim.h1 + dim.h3 + dim.h4 + outletDip(dim)
}

// The points `anchor` can name: the four corners of the silo itself, width by
// siloHeight, so the icon row hangs above whichever is used - and 'outlet',
// the centre of the hopper's exit, for hanging the silo over whatever it
// discharges into.
const ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'outlet']

// The silo's top-left corner, from dim.x / dim.y and the point they locate:
// with 'bottom-right', (x, y) is where the outlet's side of the bounding box
// ends, and the silo extends up and to the left of it. An unknown or missing
// anchor falls back to 'top-left', as does a missing x or y to 0.
function siloOrigin(dim) {
  const anchor = ANCHORS.includes(dim.anchor) ? dim.anchor : 'top-left'
  const x = dim.x ?? 0
  const y = dim.y ?? 0
  // The exit is centred under the cone, at the bottom of the outlet's sides:
  // the middle of its circle, not the lowest point of the rounded bottom in
  // front of it, which is where siloHeight ends.
  if (anchor === 'outlet') {
    return { left: x - dim.siloWidth / 2, top: y - siloHeight(dim) + outletDip(dim) }
  }
  const [vertical, horizontal] = anchor.split('-')
  return {
    left: horizontal === 'right' ? x - dim.siloWidth : x,
    top: vertical === 'bottom' ? y - siloHeight(dim) : y,
  }
}

// Any CSS colour - 'red', '#f00', 'rgb(...)', 'hsl(...)' - as #rrggbb, so
// shade() can take whatever `look` holds. A canvas context does the parsing:
// assigning fillStyle normalises a valid colour to #rrggbb and leaves an
// invalid one unchanged, so each value is checked against a known reset.
// Results are cached, since every render shades each colour many times.
const hexCache = new Map()
let parser
function toHex(colour) {
  if (hexCache.has(colour)) return hexCache.get(colour)
  parser ??= document.createElement('canvas').getContext('2d')
  parser.fillStyle = '#000000'
  parser.fillStyle = colour
  // Translucent colours come back as rgba(...), which has no #rrggbb form;
  // they fall back to black like invalid ones rather than being misread.
  const hex = /^#[0-9a-f]{6}$/i.test(parser.fillStyle) ? parser.fillStyle : '#000000'
  hexCache.set(colour, hex)
  return hex
}

// Lightens (amount > 0) or darkens (amount < 0) a colour by mixing it toward
// white or black, so each part's one base colour is enough to derive the
// whole gradient it is shaded with.
function shade(colour, amount) {
  const n = parseInt(toHex(colour).slice(1), 16)
  const target = amount < 0 ? 0 : 255
  const t = Math.abs(amount)
  const mix = (c) => Math.round(c + (target - c) * t)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// Plastic shading round a drum, lit from the front-left: a soft, broad
// falloff from light to shade with one small, bright gloss highlight left of
// centre - the look of painted or moulded plastic rather than polished metal
// (whose reflections come in several hard streaks). Each entry is
// [offset, amount] across the width (0 = left edge, 1 = right): the part's
// colour lightened (amount > 0) or darkened (amount < 0) by that much, blended
// smoothly between entries. Every part uses it, so they read as one vessel.
const PLASTIC = [
  [0, -0.3],
  [0.1, -0.08],
  [0.24, 0.1],
  [0.3, 0.5], // the gloss
  [0.35, 0.12],
  [0.55, 0],
  [0.8, -0.15],
  [1, -0.35],
]

// PLASTIC's amount at t across the width, interpolated between its entries -
// for shapes that cannot take a gradient and are shaded slice by slice.
function plasticAt(t) {
  const i = PLASTIC.findIndex(([offset]) => offset >= t)
  if (i <= 0) return PLASTIC[0][1]
  const [o0, a0] = PLASTIC[i - 1]
  const [o1, a1] = PLASTIC[i]
  return a0 + ((t - o0) / (o1 - o0)) * (a1 - a0)
}

// The hopper faces down, away from light from above, so it sits a little
// darker than the body it hangs from.
const CONE_DARKEN = -0.08

// How many slices the hopper's cone is shaded with: a linear gradient can only
// run in parallel bands, but a cone's bands meet towards its tip. Enough
// slices that neighbours differ by less than the eye picks out.
const CONE_SLICES = 48

// The silo is seen from a little above, so every horizontal circle on it -
// its top, the division seams, the fence's rails - is drawn as an ellipse
// this much flatter than it is wide. 0 would be dead level; larger looks
// further down on it.
const TILT = 0.25

// The safety fence round the top, in place of a roof: a ring of posts round
// the rim carrying a top rail and a mid rail, all within h2. Posts come
// roughly every FENCE_BAY round the circumference.
const FENCE_BAY = 10
// The seam rings round the body and hopper (dim.lineCount): each a thin dark
// groove with a fainter highlight just below it, where the lower sheet's edge
// catches the light. Translucent black and white rather than shades of the
// part's colour, so they read on any colour - white included, which cannot be
// lightened. RING is the groove's width as a share of the silo's width.
const RING = 0.012
const RING_GROOVE = 0.3
const RING_HIGHLIGHT = 0.55

// The label on the body: a translucent panel carrying a bold title, wrapped
// over as many lines as it needs to stay inside the panel (and broken at any
// '\n'), and a line per value, all centred.
// Sizes are shares of the silo's width, so the label scales with it.
const LABEL_FONT = 0.146
// The smallest the label is scaled to, to fit its lines between the rings.
const LABEL_MIN_SCALE = 0.5
const LABEL_LINE = 1.15 // line spacing, in font sizes
// A line's ink, in font sizes: from the top of its capitals and digits
// (LABEL_ASCENT above the baseline) to the bottom of descenders like 'g'.
// What has to clear the rings - the empty space above and below the letters
// in the line spacing may overlap them.
const LABEL_ASCENT = 0.72
const LABEL_INK = 0.93
// Estimated average character widths of Arial, in font sizes, for how wide
// a line is: measuring would need the text rendered first.
const LABEL_CHAR = 0.56
const LABEL_CHAR_BOLD = 0.61
// Room kept between the text and the panel's sides, in font sizes.
const LABEL_SIDE = 0.3

// How wide `text` is at `font`, bold or not: measured with the same canvas
// that parses colours, which lays text out the way the SVG will. Without a
// canvas that can measure (the SVG export runs in Node), it is estimated
// from Arial's average character widths instead.
function textWidth(text, bold, font) {
  parser ??= document.createElement('canvas').getContext('2d')
  if (!parser.measureText) return text.length * font * (bold ? LABEL_CHAR_BOLD : LABEL_CHAR)
  parser.font = `${bold ? 'bold ' : ''}100px Arial, sans-serif`
  return (parser.measureText(text).width / 100) * font
}

// Breaks `text` into lines no wider than `width`: at each '\n', and between
// words wherever the next word would overrun. A single word wider than
// `width` gets a line of its own, still too wide - the caller shrinks the
// font until it fits.
function wrapText(text, bold, font, width) {
  return String(text)
    .split('\n')
    .flatMap((paragraph) => {
      const lines = []
      let line = ''
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const tryLine = line ? `${line} ${word}` : word
        if (line && textWidth(tryLine, bold, font) > width) {
          lines.push(line)
          line = word
        } else {
          line = tryLine
        }
      }
      if (line) lines.push(line)
      return lines
    })
}
const LABEL_PANEL = 0.84 // the plate's width
// The plate's look, as shares of the silo's width so it scales with it: the
// rivets' size and inset from the corners, and the drop
// shadow that lifts the plate off the drum.
const RIVET_R = 0.016
const RIVET_INSET = 0.037
const PLATE_SHADOW = { dx: 0.005, dy: 0.01, blur: 0.008 }
// Brushed metal: a light, uneven sheen across the plate.
const PLATE_METAL = [
  [0, '#b9c0c6'],
  [0.3, '#e9edf0'],
  [0.55, '#c7cdd2'],
  [0.8, '#dde2e6'],
  [1, '#a9b0b7'],
]
const PLATE_EDGE = '#6b737b'
// Stamped text: dark ink with a thin highlight just below each letter, where
// the pressed-in edge catches the light. The drop is in font sizes.
const STAMP_INK = '#2b3036'
const STAMP_DROP = 0.045
// Clearance kept between any text and a seam ring (or the body's top and
// bottom edges), and round the text inside the panel, in font sizes.
const LABEL_CLEAR = 0.15
const LABEL_PAD = 0.4

// The far side of the fence is in the silo's own shadow and further off, so
// it is drawn this much darker than the near side.
const FENCE_FAR = -0.3
// Rail and post thickness, as a share of the silo's width, with a floor so a
// narrow silo's fence does not vanish.
const FENCE_BAR = 0.03
const FENCE_BAR_MIN = 1

function SiloShape({ dim, look, warnings, title, values, onIconClick, onSiloClick }) {
  // The icon row is drawn above the fence, so the group starts that much
  // higher and the fence lands exactly on `top`.
  const { left, top } = siloOrigin(dim)

  const [iconsOpen, setIconsOpen] = useState(false)

  // The row runs edge to edge: the first icon flush with the silo's left side,
  // the last flush with its right, the rest spread evenly between. A single
  // icon has no span to share and sits at the left.
  const step = ICONS.length > 1 ? (dim.siloWidth - ICON_SIZE) / (ICONS.length - 1) : 0
  const badge = badgeText(warnings)
  const badgeW = badge ? badgeWidth(badge) : 0
  // Mask ids are document-global, so each silo gets its own. useId's output
  // contains characters url(#...) does not accept.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const cutId = `${uid}-badge-cut`
  const fillId = (part) => `${uid}-${part}-fill`

  const W = dim.siloWidth
  // How far the fence's posts and the cone reach in under the body. Where two
  // shapes only meet edge to edge, each covers half of the pixels along the
  // seam and the background shows through as a hairline; with the neighbour
  // running on under the body, the seam's pixels are body over it instead.
  const SEAM = 1
  const bar = Math.max(FENCE_BAR_MIN, W * FENCE_BAR)
  // The ellipse every horizontal circle is drawn as: rx across, ry deep.
  const rx = W / 2
  const ry = rx * TILT
  // A circle's front half (bulging down, towards the viewer) and back half
  // (bulging up), as arcs through its leftmost and rightmost points - split
  // so that whatever stands between the two can be drawn in between.
  const frontArc = (cy, r = rx) => `M ${W / 2 + r} ${cy} A ${r} ${r * TILT} 0 0 1 ${W / 2 - r} ${cy}`
  const backArc = (cy, r = rx) => `M ${W / 2 - r} ${cy} A ${r} ${r * TILT} 0 0 1 ${W / 2 + r} ${cy}`

  // The fence's rails: circles inset by half a bar so their strokes stay
  // within the silo's width, the top one as high as fits inside h2, the mid
  // one halfway between it and the rim at the top of the body.
  const railR = rx - bar / 2
  const topRail = railR * TILT + bar / 2
  const rails = [topRail, (topRail + dim.h2) / 2]
  // The posts, spaced evenly round the rim. angle 0 is nearest the viewer;
  // cos(angle) > 0 is the near half, drawn in front of the body's top, and
  // the rest the far half, behind it. Each post runs from the top rail down
  // to the rim, at the depth its angle puts it.
  const posts = Math.max(4, Math.round((Math.PI * W) / FENCE_BAY))
  const fence = Array.from({ length: posts }, (_, i) => {
    const angle = ((i + 0.5) / posts) * 2 * Math.PI
    const x = W / 2 + railR * Math.sin(angle)
    const depth = railR * TILT * Math.cos(angle)
    return {
      angle,
      near: Math.cos(angle) > 0,
      x: x - bar / 2,
      y: topRail + depth,
      height: dim.h2 - topRail,
      // Lit like the drum it stands round: from where it sits across it.
      colour: shade(look.roof, plasticAt(x / W) + (Math.cos(angle) > 0 ? 0 : FENCE_FAR)),
    }
  })
  const coneTop = dim.h2 + dim.h1
  const coneBottom = coneTop + dim.h3

  // The cone runs from the body's bottom circle (radius rx, at coneTop) to the
  // outlet's top circle (radius r2, at coneBottom), both seen as ellipses.
  // Its sides are not the lines between the ellipses' end points: seen from
  // above, the cone's outline is the pair of lines that just touch both
  // ellipses, meeting the big one a little in front of its ends - drawing
  // from the ends instead leaves the body's rounded bottom sticking out past
  // the cone. Squashed back into circles (y / TILT) the touching lines are
  // the circles' outer tangents, at angle phi off the vertical.
  const r2 = dim.w2 / 2
  const ry2 = r2 * TILT
  const phi = Math.asin(Math.min(1, ((rx - r2) * TILT) / dim.h3))
  // Positions round the cone as an angle from its front (0), -90deg at the
  // far left to +90deg at the far right. What is in view runs between the
  // two tangent lines, at +/-(90deg - phi).
  const reach = Math.PI / 2 - phi
  const bigAt = (a) => [W / 2 + rx * Math.sin(a), coneTop + ry * Math.cos(a)]
  const smallAt = (a) => [W / 2 + r2 * Math.sin(a), coneBottom + ry2 * Math.cos(a)]
  // The cone as slices, each between two lines straight down its surface
  // from the body to the outlet, coloured with PLASTIC at its middle. Each
  // runs half a slice into the next, which paints over it, so the opaque
  // slices leave no seam; and SEAM on up into the body, which covers it.
  //
  // The run into the body continues each line in its own direction, not
  // straight up: the outermost lines are the cone's outline, and moving
  // their top ends straight up would tilt them in off the tangent, leaving a
  // sliver of background between the cone and the body's rounded bottom.
  const upInto = ([x, y], [u, v]) => {
    const len = Math.hypot(x - u, y - v) || 1
    return [x + ((x - u) / len) * SEAM, y + ((y - v) / len) * SEAM]
  }
  const coneSlices = Array.from({ length: CONE_SLICES }, (_, i) => {
    const a0 = -reach + (2 * reach * i) / CONE_SLICES
    const a1 = -reach + (2 * reach * Math.min(CONE_SLICES, i + 1.5)) / CONE_SLICES
    const mid = -reach + (2 * reach * (i + 0.5)) / CONE_SLICES
    const [u0, v0] = smallAt(a0)
    const [u1, v1] = smallAt(a1)
    const [x0, y0] = upInto(bigAt(a0), [u0, v0])
    const [x1, y1] = upInto(bigAt(a1), [u1, v1])
    return {
      key: i,
      points: `${x0},${y0} ${x1},${y1} ${u1},${v1} ${u0},${v0}`,
      colour: shade(look.hopper, plasticAt((Math.sin(mid) + 1) / 2) + CONE_DARKEN),
    }
  })
  // The cone's outline: down the left tangent, round the front of the
  // outlet's circle, up the right tangent, and back round the front of the
  // body's bottom circle.
  const [lx, ly] = bigAt(-reach)
  const [rX, rY] = bigAt(reach)
  const [blx, bly] = smallAt(-reach)
  const [brx, bry] = smallAt(reach)
  const coneD = `M ${lx} ${ly} L ${blx} ${bly} A ${r2} ${ry2} 0 0 0 ${brx} ${bry} L ${rX} ${rY} A ${rx} ${ry} 0 0 1 ${lx} ${ly} Z`
  // The outlet: a short cylinder hanging from the cone, its bottom the front
  // half of a circle like the body's.
  // The seam rings, spaced evenly along the surface from the top of the body
  // to the outlet - measured down the cone's slope, not straight down, so
  // the sheets look the same height on the cone as on the body. Each ring is
  // the front of a horizontal circle: on the body the whole front half; on
  // the cone the part between its two outline tangents, since the circle
  // shrinks towards the outlet and its ends tuck behind the cone's sides.
  const ringCount = Math.max(0, Math.floor(dim.lineCount ?? 0))
  const slant = Math.hypot(dim.h3, rx - r2)
  const ringAt = (k) => {
    const along = ((dim.h1 + slant) * k) / (ringCount + 1)
    if (along <= dim.h1) {
      const y = dim.h2 + along
      return { onCone: false, y, d: `M 0 ${y} A ${rx} ${ry} 0 0 0 ${W} ${y}` }
    }
    const f = (along - dim.h1) / slant
    const r = rx + (r2 - rx) * f
    const cy = coneTop + dim.h3 * f
    const x = r * Math.sin(reach)
    const y = cy + r * TILT * Math.cos(reach)
    return { onCone: true, d: `M ${W / 2 - x} ${y} A ${r} ${r * TILT} 0 0 0 ${W / 2 + x} ${y}` }
  }
  const rings = Array.from({ length: ringCount }, (_, i) => ringAt(i + 1))
  const ringW = W * RING
  const drawRings = (onCone) =>
    rings
      .filter((ring) => ring.onCone === onCone)
      .map(({ d }) => (
        <g key={d} fill="none">
          <path d={d} stroke="#000" strokeOpacity={RING_GROOVE} strokeWidth={ringW} />
          <path
            d={d}
            transform={`translate(0,${ringW})`}
            stroke="#fff"
            strokeOpacity={RING_HIGHLIGHT}
            strokeWidth={ringW * 0.8}
          />
        </g>
      ))

  // The label. Its lines must not cross a ring, so they go in the gaps
  // between rings (layoutLabel), starting from whichever gap leaves the
  // label centred on the body. If a line cannot fit between two rings at
  // the full size, the whole label is scaled down step by step until every
  // line does - never below LABEL_MIN_SCALE, where it gives up and lets the
  // lines that still do not fit sit where there is most room.
  const panelW = W * LABEL_PANEL
  // The label is centred on the body: between its top rim and the bottom
  // where it meets the cone.
  const bodyMiddle = dim.h2 + dim.h1 / 2
  const layoutLabel = (font) => {
    // The title wraps to the panel's inside width; each value stays one line.
    const inside = panelW - 2 * font * LABEL_SIDE
    const lines = [
      ...(title ? wrapText(title, true, font, inside).map((text) => ({ text, bold: true })) : []),
      ...(values ?? []).map((value) => ({ text: String(value), bold: false })),
    ].map((line) => ({ ...line, width: textWidth(line.text, line.bold, font) }))
    // Too wide for the panel - a long value, or a title word longer than a
    // line - counts as not fitting, so the font shrinks as for the rings.
    const wideEnough = lines.every((line) => line.width <= inside)
    const lineH = font * LABEL_LINE
    const ink = font * LABEL_INK
    const clear = font * LABEL_CLEAR
    // Across the text's width a ring is not level: the front of its circle
    // is lowest mid-way and rises towards the sides. So a ring blocks from
    // where its arc crosses the widest line's ends down to its lowest point,
    // plus its own thickness.
    const widest = Math.min(panelW, Math.max(0, ...lines.map((l) => l.width)))
    const dip = ry * Math.sqrt(Math.max(0, 1 - (widest / 2 / rx) ** 2))
    const blocked = [
      // The body's top: its rim, down to the front of the top face.
      [-Infinity, dim.h2 + ry + clear],
      ...rings.filter((ring) => !ring.onCone).map(({ y }) => [y + dip - clear, y + ry + ringW * 1.8 + clear]),
      // The body's rounded bottom, from where it crosses the text's ends.
      [coneTop + dip - clear, Infinity],
    ]
    const gaps = blocked
      .slice(1)
      .map(([bottom], i) => [blocked[i][1], bottom])
      .filter(([a, b]) => b > a)
    // n lines stacked take (n - 1) line spacings plus one line's ink.
    const need = (n) => (n - 1) * lineH + ink
    // Lines in order from gap `start`, as many to a gap as fit, moving down a
    // gap when the next will not. `fits` is false if some line had no gap
    // left to hold it.
    const pack = (start) => {
      const byGap = gaps.map(() => [])
      let g = start
      let fits = true
      for (const line of lines) {
        while (g < gaps.length && need(byGap[g].length + 1) > gaps[g][1] - gaps[g][0]) g++
        if (g === gaps.length) {
          fits = false
          g = gaps.reduce((best, gp, k) => (gp[1] - gp[0] > gaps[best][1] - gaps[best][0] ? k : best), 0)
        }
        byGap[g].push(line)
      }
      // Each gap's lines centred in it as a block. `top` is where a line's
      // ink starts; its baseline is LABEL_ASCENT below.
      const placed = byGap.flatMap((inGap, k) => {
        const from = (gaps[k][0] + gaps[k][1] - need(inGap.length)) / 2
        return inGap.map((line, i) => ({ ...line, top: from + i * lineH }))
      })
      const top = Math.min(...placed.map((l) => l.top))
      const bottom = Math.max(...placed.map((l) => l.top)) + ink
      return { fits, placed, offCentre: Math.abs((top + bottom) / 2 - bodyMiddle) }
    }
    // Every gap the lines could start from, and of those that fit, the one
    // that puts the label's middle nearest the body's.
    const tries = gaps.map((_, start) => pack(start))
    const fitting = tries.filter((t) => t.fits)
    const { fits, placed } = (fitting.length ? fitting : tries).reduce((best, t) =>
      t.offCentre < best.offCentre ? t : best,
    )
    return { font, ink, fits: fits && wideEnough, placed }
  }
  let label = layoutLabel(W * LABEL_FONT)
  for (let scale = 0.95; !label.fits && scale >= LABEL_MIN_SCALE; scale -= 0.05) {
    label = layoutLabel(W * LABEL_FONT * scale)
  }
  // The panel wraps all the text with LABEL_PAD round it.
  const panel = label.placed.length > 0 && {
    top: Math.min(...label.placed.map((l) => l.top)) - label.font * LABEL_PAD,
    bottom: Math.max(...label.placed.map((l) => l.top)) + label.ink + label.font * LABEL_PAD,
  }

  const outletD = `M ${W / 2 - r2} ${coneBottom} L ${W / 2 - r2} ${coneBottom + dim.h4} A ${r2} ${ry2} 0 0 0 ${W / 2 + r2} ${coneBottom + dim.h4} L ${W / 2 + r2} ${coneBottom} Z`

  return (
    <g className={`silo${iconsOpen ? ' open' : ''}`} transform={`translate(${left},${top - ICON_ROW})`}>
      <g className="silo-icons">
        {ICONS.map(({ name, Icon }, i) => (
          <g
            key={name}
            className={`silo-icon${name === 'warning' && badge ? ' alarm' : ''}`}
            role="button"
            aria-label={name}
            transform={`translate(${i * step},${BADGE_H / 2})`}
            onClick={() => onIconClick?.(name)}
          >
            <title>{name}</title>
            {/*
              A lucide icon is stroke only, so on its own just its lines take
              the click. The painted square behind it makes the whole icon,
              gaps included, the target.
            */}
            <rect width={ICON_SIZE} height={ICON_SIZE} fill="transparent" />
            {/*
              With a badge, the icon is drawn through a mask that cuts a hole
              around the badge, so the triangle's lines end in a clean gap
              instead of butting against the pill.
            */}
            {name === 'warning' && badge ? (
              <>
                <mask id={cutId}>
                  <rect width={ICON_SIZE} height={ICON_SIZE} fill="white" />
                  <rect
                    x={BADGE_X - BADGE_CUT}
                    y={BADGE_Y - BADGE_H / 2 - BADGE_CUT}
                    width={badgeW + 2 * BADGE_CUT}
                    height={BADGE_H + 2 * BADGE_CUT}
                    rx={BADGE_H / 2 + BADGE_CUT}
                    fill="black"
                  />
                </mask>
                <g mask={`url(#${cutId})`}>
                  <Icon size={ICON_SIZE} />
                </g>
              </>
            ) : (
              <Icon size={ICON_SIZE} />
            )}
            {name === 'warning' && badge && (
              <g className="silo-badge" transform={`translate(${BADGE_X},${BADGE_Y})`}>
                <rect y={-BADGE_H / 2} width={badgeW} height={BADGE_H} rx={BADGE_H / 2} />
                {/*
                  dy rather than dominant-baseline: 0.35em drops the digits'
                  middle onto y=0 the same way in every browser, where
                  'central' shifts with the font.
                */}
                <text x={badgeW / 2} dy="0.35em" textAnchor="middle" fontSize={BADGE_FONT}>
                  {badge}
                </text>
              </g>
            )}
          </g>
        ))}
      </g>
      {/*
        The toggle is on the silo's own shapes, not the outer group, so a
        click on an icon or between icons does not also close the row.
      */}
      <g
        className="silo-body"
        transform={`translate(0,${ICON_ROW})`}
        onClick={() => {
          setIconsOpen((open) => !open)
          onSiloClick?.()
        }}
        stroke={look.outline}
        strokeLinejoin="round"
      >
        {/*
          Every part is shaded with the same PLASTIC profile, so the gloss
          runs unbroken from the fence down to the outlet. Gradients where
          the bands run straight (body, outlet, posts); slices on the cone,
          where they converge towards the outlet.
        */}
        <defs>
          {[['body', look.body], ['hopper', look.hopper], ['post', look.roof]].map(([part, colour]) => (
            <linearGradient key={part} id={fillId(part)} x1="0" y1="0" x2="1" y2="0">
              {PLASTIC.map(([offset, amount]) => (
                <stop key={offset} offset={offset} stopColor={shade(colour, amount)} />
              ))}
            </linearGradient>
          ))}
          {/*
            Down the cone the surface tips further from the light, so it
            darkens towards the outlet. Clear at the top, where it meets the
            body.
          */}
          <linearGradient id={fillId('cone')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {/*
          Filled parts first, the division lines after, so no fill paints
          over a line.

          Bottom up: the outlet, then the cone, whose rim at the bottom
          wraps round in front of the outlet's top, then the body, whose
          rounded bottom sits in front of the cone's top.
        */}
        <path d={outletD} fill={`url(#${fillId('hopper')})`} />
        <g stroke="none">
          {coneSlices.map(({ key, points, colour }) => (
            <polygon key={key} points={points} fill={colour} />
          ))}
          <path d={coneD} fill={`url(#${fillId('cone')})`} />
        </g>
        {/*
          The cone's rings before the body, which covers any that pass
          behind its rounded bottom; the body's after it.
        */}
        {drawRings(true)}
        {/* The cone's outline, drawn once over its slices. */}
        <path d={coneD} fill="none" />
        {/*
          Back to front: the fence's far half, then the body with its top,
          then the fence's near half, so the body hides the far posts' feet
          and the near posts stand in front of it. Within each half, rails
          over posts, as a rail runs in front of the posts it is fixed to.

          The fence is stroke="none" and flat-shaded per post: its bars are
          too thin for an outline or a gradient across them to read.
        */}
        <g stroke="none">
          {fence.filter((p) => !p.near).map((p) => (
            <rect key={p.angle} x={p.x} y={p.y} width={bar} height={p.height} fill={p.colour} />
          ))}
        </g>
        {rails.map((cy) => (
          <path
            key={cy}
            d={backArc(cy, railR)}
            fill="none"
            stroke={shade(look.roof, FENCE_FAR)}
            strokeWidth={bar}
          />
        ))}
        {/*
          The body: its sides, down to the front half of its bottom circle
          where it meets the cone, then its top - a full ellipse, lit a
          little brighter as it faces up. The top's back half forms the
          silo's upper edge; its front half is the rim the near posts
          stand on.
        */}
        <path
          d={`M 0 ${dim.h2} L 0 ${coneTop} A ${rx} ${ry} 0 0 0 ${W} ${coneTop} L ${W} ${dim.h2} Z`}
          fill={`url(#${fillId('body')})`}
        />
        <ellipse cx={W / 2} cy={dim.h2} rx={rx} ry={ry} fill={shade(look.body, 0.15)} />
        {drawRings(false)}
        {panel && (() => {
          // The plate is painted on the drum, so it is drawn unrolled and
          // bent round: every point at height v in the layout lands
          // drumCurve(x) lower on screen - the same curve the rings follow,
          // lowest mid-way, where the drum is nearest the viewer.
          const drumCurve = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - W / 2) / rx) ** 2))
          const at = (x, v) => `${x} ${v + drumCurve(x)}`
          // An arc of the drum's curve at height v, from x0 to x1.
          const arc = (x0, x1, v) => `A ${rx} ${ry} 0 0 ${x1 > x0 ? 0 : 1} ${at(x1, v)}`
          // A rectangle of the unrolled label, bent round the drum: straight
          // sides, top and bottom following the curve.
          const bentRect = (x0, x1, v0, v1) =>
            `M ${at(x0, v0)} ${arc(x0, x1, v0)} L ${at(x1, v1)} ${arc(x1, x0, v1)} Z`
          // Seen on the curve, anything towards the sides is foreshortened:
          // this much narrower than it is mid-way.
          const squeeze = (x) => Math.sqrt(Math.max(0.05, 1 - ((x - W / 2) / rx) ** 2))

          const plateX = (W - panelW) / 2
          const plateD = bentRect(plateX, plateX + panelW, panel.top, panel.bottom)
          const bevel = W * 0.012
          const inset = W * RIVET_INSET
          const drop = label.font * STAMP_DROP
          // The rule sits half-way between the title's last line and the
          // first value, when there are both.
          const lastTitle = label.placed.findLast((line) => line.bold)
          const firstValue = label.placed.find((line) => !line.bold)
          const ruleY = lastTitle && firstValue && (lastTitle.top + label.ink + firstValue.top) / 2
          const lineId = (i) => fillId(`label-line-${i}`)
          return (
            <g className="silo-label" stroke="none">
              <defs>
                <linearGradient id={fillId('plate')} x1="0" y1="0" x2="1" y2="0.15">
                  {PLATE_METAL.map(([offset, colour]) => (
                    <stop key={offset} offset={offset} stopColor={colour} />
                  ))}
                </linearGradient>
                {/*
                  The drum's own light and shade over the plate, as it bends
                  round with it: PLASTIC's lightening as white, its darkening
                  as black, each fading out where the other takes over.
                */}
                <linearGradient id={fillId('plate-light')} x1="0" y1="0" x2="1" y2="0">
                  {PLASTIC.map(([offset, amount]) => (
                    <stop key={offset} offset={offset} stopColor="#fff" stopOpacity={Math.max(0, amount) * 0.7} />
                  ))}
                </linearGradient>
                <linearGradient id={fillId('plate-shade')} x1="0" y1="0" x2="1" y2="0">
                  {PLASTIC.map(([offset, amount]) => (
                    <stop key={offset} offset={offset} stopColor="#000" stopOpacity={Math.max(0, -amount) * 0.8} />
                  ))}
                </linearGradient>
                <radialGradient id={fillId('rivet')} cx="0.35" cy="0.35" r="0.7">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset="0.5" stopColor="#b8bec4" />
                  <stop offset="1" stopColor="#6d747b" />
                </radialGradient>
                <filter id={fillId('plate-shadow')} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx={W * PLATE_SHADOW.dx}
                    dy={W * PLATE_SHADOW.dy}
                    stdDeviation={W * PLATE_SHADOW.blur}
                    floodColor="#000"
                    floodOpacity="0.35"
                  />
                </filter>
                {/*
                  Each line's baseline, bent round the drum: an arc of the
                  curve across the silo's whole width, so a line centred on
                  it (startOffset 50%) sits mid-way and curves evenly.
                */}
                {label.placed.map((line, i) => {
                  const base = line.top + label.font * LABEL_ASCENT
                  return <path key={i} id={lineId(i)} d={`M ${at(0, base)} ${arc(0, W, base)}`} />
                })}
              </defs>
              <path
                d={plateD}
                fill={`url(#${fillId('plate')})`}
                stroke={PLATE_EDGE}
                strokeWidth={W * 0.006}
                filter={`url(#${fillId('plate-shadow')})`}
              />
              <path d={plateD} fill={`url(#${fillId('plate-light')})`} />
              <path d={plateD} fill={`url(#${fillId('plate-shade')})`} />
              {/* A bevel: a fine light line just inside the edge. */}
              <path
                d={bentRect(plateX + bevel, plateX + panelW - bevel, panel.top + bevel, panel.bottom - bevel)}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.6"
                strokeWidth={W * 0.005}
              />
              {[plateX + inset, plateX + panelW - inset].flatMap((cx) =>
                [panel.top + inset, panel.bottom - inset].map((cy) => (
                  <ellipse
                    key={`${cx},${cy}`}
                    cx={cx}
                    cy={cy + drumCurve(cx)}
                    rx={W * RIVET_R * squeeze(cx)}
                    ry={W * RIVET_R}
                    fill={`url(#${fillId('rivet')})`}
                    stroke="#5b636b"
                    strokeWidth={W * 0.0025}
                  />
                )),
              )}
              {ruleY && (
                <path
                  d={`M ${at(plateX + W * 0.1, ruleY)} ${arc(plateX + W * 0.1, plateX + panelW - W * 0.1, ruleY)}`}
                  fill="none"
                  stroke="#7d858c"
                  strokeWidth={W * 0.005}
                />
              )}
              {/*
                Stamped: a light copy of each line a hair below it, then the
                line itself, both along its bent baseline.
              */}
              {label.placed.map((line, i) => (
                <g
                  key={i}
                  fontFamily="Arial, sans-serif"
                  fontSize={label.font}
                  fontWeight={line.bold ? 700 : 400}
                >
                  <text transform={`translate(0,${drop})`} fill="#fff" fillOpacity="0.75">
                    <textPath href={`#${lineId(i)}`} startOffset="50%" textAnchor="middle">
                      {line.text}
                    </textPath>
                  </text>
                  <text fill={look.text ?? STAMP_INK}>
                    <textPath href={`#${lineId(i)}`} startOffset="50%" textAnchor="middle">
                      {line.text}
                    </textPath>
                  </text>
                </g>
              ))}
            </g>
          )
        })()}
        <g stroke="none">
          {fence.filter((p) => p.near).map((p) => (
            <rect key={p.angle} x={p.x} y={p.y} width={bar} height={p.height} fill={p.colour} />
          ))}
        </g>
        {rails.map((cy) => (
          <path
            key={cy}
            d={frontArc(cy, railR)}
            fill="none"
            stroke={`url(#${fillId('post')})`}
            strokeWidth={bar}
          />
        ))}
        {/*
          One line per division, drawn between the rows rather than through
          the block's own edges: `line` divisions need `line - 1` separators,
          so the last one does not land on the rect's bottom border and draw
          over it. Each is a seam round the drum, so only its front half -
          the half facing the viewer - is drawn.

          map, not forEach: forEach returns undefined, so the paths were
          built and then thrown away - which is why nothing appeared inside
          the rectangle.
        */}
        <g transform={`translate(0,${dim.h2})`}>
          {Array.from({ length: dim.lines - 1 }, (_, i) => (
            <path
              key={i}
              d={frontArc(((i + 1) * dim.h1) / dim.lines)}
              fill="none"
            />
          ))}
        </g>
      </g>
    </g>
  )
}

/**
 * The silo and what a caller needs to place it.
 *
 * Called as a function, not rendered as <Silo />, because it returns more than
 * an element:
 *
 *   const silo = Silo({ dim, look, warnings, title, values, onIconClick, onSiloClick })
 *
 *   title   the label's heading, bold; wraps to fit the panel, and '\n'
 *           forces a break
 *   values  the lines under it, one string each (e.g. '1234.56 kg')
 *   silo.element   the drawing, to put inside an <svg>
 *   silo.width     total width
 *   silo.height    the silo's own height, fence to outlet. The icon row is
 *                  not counted: it is drawn above the fence, so a silo whose
 *                  top is at y needs ICON_ROW of room above y for it.
 *
 * No hooks run here - the icon row's state lives in SiloShape - so calling it
 * like a plain function is safe, including conditionally or in a loop.
 */
function Silo({ dim, look, warnings = 0, title, values, onIconClick, onSiloClick }) {
  return {
    element: (
      <SiloShape
        dim={dim}
        look={look}
        warnings={warnings}
        onIconClick={onIconClick}
        onSiloClick={onSiloClick}
        title={title}
        values={values}
      />
    ),
    width: dim.siloWidth,
    height: siloHeight(dim),
  }
}

export default Silo
