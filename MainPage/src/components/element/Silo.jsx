import { useId, useState } from 'react'
import { Info, Settings, TriangleAlert } from 'lucide-react'
import { SiloValues, readValue } from './SiloValues'
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
 *   dim   lines, lineCount (seam rings), labelGap (between icons), siloWidth, h1 (body), h2 (fence), h3 / h4 (hopper cone and
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
  { name: 'info', Icon: Info },
  { name: 'settings', Icon: Settings },
]
// The icon row spans the silo's width, its icons a fixed gap apart -
// dim.labelGap, or ICON_GAP - and as large as that leaves room for. The
// row's sizes below are for an icon ICON_SIZE across; the row is drawn at
// that size and scaled (iconScale) to the size the icons actually get, so
// their badge and the row's height scale with them, while the gap does not.
const ICON_SIZE = 12
// The gap between neighbouring icons, in the silo's units, when dim.labelGap
// does not set one. Fixed: it does not scale with the silo.
const ICON_GAP = 15
// How much the row is scaled for a silo `dim`: the icon size that fills its
// width at the gap, over ICON_SIZE. Never below a tenth, however tight.
function iconScale(dim) {
  const gaps = (ICONS.length - 1) * (dim.labelGap ?? ICON_GAP)
  return Math.max(0.1, (dim.siloWidth - gaps) / ICONS.length / ICON_SIZE)
}
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
// The row's height including the badge above and the gap down to the fence,
// at ICON_SIZE; iconRow gives it for a silo `dim`.
const ICON_ROW = BADGE_H / 2 + ICON_SIZE + 4
const iconRow = (dim) => ICON_ROW * iconScale(dim)

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

// Text sizes are shares of the silo's width, so the text scales with it.
const LABEL_FONT = 0.146
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

// The title, above the silo on a single line: at the label's font size, or
// smaller if that is what it takes to fit across the silo's width. It sits
// TITLE_GAP above the fence and stays there; the icons float up above it when
// they show (Silo.css animates them).
const TITLE_GAP = 2 // at ICON_SIZE; scaled like the icon row
// The title's font size for `title` on a silo `width` wide.
function titleFont(title, width) {
  const full = width * LABEL_FONT
  const wide = textWidth(String(title), true, full)
  return wide > width ? full * (width / wide) : full
}
// How much room above the silo's top the icon row and title need: the row,
// floated up clear of the title - its gap and ink - when it shows.
function titleRoom(title, dim) {
  return title
    ? iconRow(dim) + TITLE_GAP * iconScale(dim) + titleFont(title, dim.siloWidth) * LABEL_INK
    : iconRow(dim)
}

// How wide `text` is at `font`, bold or not: measured with the same canvas
// that parses colours, which lays text out the way the SVG will. Without a
// canvas that can measure (the SVG export runs in Node), it is estimated
// from Arial's average character widths instead.
function textWidth(text, bold, font, family = 'Arial, sans-serif') {
  parser ??= document.createElement('canvas').getContext('2d')
  if (!parser.measureText) return text.length * font * (bold ? LABEL_CHAR_BOLD : LABEL_CHAR)
  parser.font = `${bold ? 'bold ' : ''}100px ${family}`
  return (parser.measureText(text).width / 100) * font
}

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

  // The icons edge to edge across the silo, the fixed gap between each - in
  // the row's own units, which the row's scale shrinks the gap into.
  const step = ICON_SIZE + (dim.labelGap ?? ICON_GAP) / iconScale(dim)
  const badge = badgeText(warnings)
  // How far the icons float up when they show: clear of the title, if there
  // is one, which sits where the icons would otherwise be.
  const iconLift = title ? TITLE_GAP * iconScale(dim) + titleFont(title, dim.siloWidth) * LABEL_INK : 0
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

  // The values, for the data plate on the body (SiloValues).
  const readings = (values ?? []).map(readValue)

  const outletD = `M ${W / 2 - r2} ${coneBottom} L ${W / 2 - r2} ${coneBottom + dim.h4} A ${r2} ${ry2} 0 0 0 ${W / 2 + r2} ${coneBottom + dim.h4} L ${W / 2 + r2} ${coneBottom} Z`

  return (
    <g className={`silo${iconsOpen ? ' open' : ''}`} transform={`translate(${left},${top - iconRow(dim)})`}>
      {title && (() => {
        const font = titleFont(title, W)
        // The title's ink ends TITLE_GAP above the fence.
        return (
          <g className="silo-title">
            <text
              x={W / 2}
              y={iconRow(dim) - TITLE_GAP * iconScale(dim) - font * (LABEL_INK - LABEL_ASCENT)}
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize={font}
              fontWeight={700}
              fill={look.text ?? '#000'}
            >
              {title}
            </text>
          </g>
        )
      })()}
      {/* Drawn at ICON_SIZE and scaled to the icons' size, badge and all. */}
      <g className="silo-icons" transform={`scale(${iconScale(dim)})`}>
        {/*
          The warning icon is drawn last, so it lies on top: its badge
          reaches over towards the next icon, and SVG paints in document
          order. Each icon keeps its place in the row by its index `i`.
        */}
        {ICONS.map((icon, i) => ({ ...icon, i }))
          .sort((a, b) => (a.name === 'warning') - (b.name === 'warning'))
          .map(({ name, Icon, i }) => (
          // Hidden, an icon rests down behind the title; shown - the row
          // open, or the warning icon kept up by an alarm - it floats up
          // above it, fading in as it goes (Silo.css). The float is on a
          // wrapper so its CSS transform does not replace the icon's own
          // position, which is a transform attribute.
          <g
            key={name}
            className="silo-icon-float"
            style={{
              // iconLift is in the silo's units; inside the scaled row it is
              // that much smaller.
              transform: `translateY(${iconsOpen || (name === 'warning' && badge) ? -iconLift / iconScale(dim) : 0}px)`,
            }}
          >
            <g
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
          </g>
        ))}
      </g>
      {/*
        The toggle is on the silo's own shapes, not the outer group, so a
        click on an icon or between icons does not also close the row.
      */}
      <g
        className="silo-body"
        transform={`translate(0,${iconRow(dim)})`}
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
        <SiloValues
          readings={readings}
          g={{ W, bodyTop: dim.h2, bodyBottom: coneTop, look, measure: textWidth }}
        />
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
 *   title   the silo's name, bold, on one line above it - shrunk to fit the
 *           silo's width if it is long; floats up while the icons show
 *   values  on the body, each a string ('1234.56 kg') or { value, unit }
 *           - see SiloValues. Stacked and centred on the body: required,
 *           then served
 *   silo.element   the drawing, to put inside an <svg>
 *   silo.width     total width
 *   silo.height    the silo's own height, fence to outlet. The icon row and
 *                  the title are not counted: they are drawn above the fence.
 *   silo.above     how much room they need above the silo's top - leave at
 *                  least this much between it and whatever is above.
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
    above: titleRoom(title, dim),
  }
}

export default Silo
