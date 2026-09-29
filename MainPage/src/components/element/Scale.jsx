import { useId } from 'react'
import { PLASTIC, TILT, plasticAt, shade } from './Silo'

/**
 * A weigh hopper - the scale a silo discharges into - seen from the side and
 * a little above, as an SVG group, shaded in 3D like the silo: the same
 * PLASTIC profile, and every horizontal circle drawn as an ellipse `tilt`
 * times as deep as it is wide. After design/Scales.svg: the bowl, an open
 * cylinder with its rim and the dark inside showing at the top; the cone
 * under it, narrowing to the outlet; and the outlet, a short cylinder. The
 * weight and a lamp sit on the cone's front.
 *
 * Draws a <g class="scale">, not an <svg>, like the silo, so it shares the
 * caller's canvas and coordinate system.
 *
 *   dim   every size, in the caller's units - see SCALE_DIM for the defaults.
 *         Any that is missing, or not a number, takes its default; sizes
 *         below 0 are taken as 0:
 *           width          the bowl's diameter, which the cone starts at
 *           bowlHeight     the bowl's side, top circle to bottom circle
 *           rimWidth       the rim round the bowl's open top
 *           coneHeight     bowl's bottom circle to the outlet's top circle
 *           coneBottom     the cone's diameter where it meets the outlet
 *           outletWidth    the outlet's diameter
 *           outletHeight
 *           tilt           how far down on it it is seen: each circle's
 *                          depth as a share of its width. 0 is dead level
 *                          (flat 2D); the silo uses 0.25
 *           fontSize       the weight's text
 *           valueX         the weight's centre, across from the middle
 *                          (negative is left)
 *           valueY         the weight's baseline, down from the front of
 *                          the cone's top - where it meets the bowl
 *           lampRadius
 *           lampX          the lamp's centre, across from the middle
 *           lampY          the lamp's centre, down from the same point
 *           lampStroke     the lamp's outline width; 0 hides it
 *         x, y and anchor place it: 'top-left' (the default), the top-left
 *         corner of its bounding box; 'inlet', the middle of the bowl's open
 *         top, for hanging it under a silo's outlet; or 'outlet', the middle
 *         of the outlet's bottom circle
 *   look  fill, the metal, shaded from it; inside, the bowl's inside seen
 *         through the top; strokes, false to hide every stroke - the
 *         outline and the lamp's - whatever else is set; outline and
 *         strokeWidth, the stroke - 'none' to hide it; text, fontFamily and fontWeight, the weight's; lampOn and
 *         lampOff, the lamp's colour lit and unlit; lampOutline, its stroke
 *         (see SCALE_LOOK)
 *   value  the weight, shown on the cone - a string or number; nothing hides it
 *   lamp   true lights the lamp; anything else leaves it off
 */

// The defaults: Scales.svg's proportions at the silo's width of 80, the cone
// a little taller so the weight and lamp fit on its front once it is seen
// from above.
export const SCALE_DIM = {
  width: 80,
  bowlHeight: 22,
  rimWidth: 3,
  coneHeight: 34,
  coneBottom: 27.7,
  outletWidth: 27.3,
  outletHeight: 7.9,
  tilt: TILT,
  fontSize: 10,
  valueX: 0,
  valueY: 11,
  lampRadius: 3.5,
  lampX: 0,
  lampY: 19,
  lampStroke: 0,
}
// The dim entries that are offsets, not sizes, so may be negative.
const OFFSETS = ['valueX', 'lampX']

export const SCALE_LOOK = {
  fill: '#d9dde1',
  inside: '#3b4148',
  strokes: true,
  outline: '#5b636b',
  strokeWidth: 0.5,
  text: '#000',
  fontFamily: 'Arial, sans-serif',
  fontWeight: 700,
  lampOn: '#e02020',
  lampOff: '#9ca3af',
  lampOutline: '#000',
}

// dim laid over SCALE_DIM, every entry a number: a missing or non-numeric
// one takes its default, and a size below 0 is taken as 0. x, y and anchor
// are passed through for scaleOrigin.
function readDim(dim = {}) {
  const d = { x: dim.x, y: dim.y, anchor: dim.anchor }
  for (const key in SCALE_DIM) {
    const given = dim[key] !== undefined && dim[key] !== null && dim[key] !== ''
    const n = given && Number.isFinite(Number(dim[key])) ? Number(dim[key]) : SCALE_DIM[key]
    d[key] = OFFSETS.includes(key) ? n : Math.max(0, n)
  }
  return d
}

// The cone faces down, away from light from above, so it sits a little
// darker than the bowl - as the silo's hopper.
const CONE_DARKEN = -0.08
// Slices the cone is shaded in: its bands meet towards the outlet, which a
// linear gradient cannot do. As the silo's.
const CONE_SLICES = 48
// How far each cone slice runs up under the bowl, so no hairline of
// background shows along the seam.
const SEAM = 1

const ANCHORS = ['top-left', 'inlet', 'outlet']

// The heights the scale is laid out by, down from its bounding box's top:
// the bowl's top circle (its centre), its bottom circle, the outlet's top
// circle and its bottom circle - and the whole height, down to the front of
// that last one.
function scaleLevels(d) {
  const top = (d.width / 2) * d.tilt
  const bowlBottom = top + d.bowlHeight
  const coneEnd = bowlBottom + d.coneHeight
  const outletEnd = coneEnd + d.outletHeight
  return { top, bowlBottom, coneEnd, outletEnd, height: outletEnd + (d.outletWidth / 2) * d.tilt }
}

// The bounding box's top-left corner, from x / y and the point anchor names.
// An unknown or missing anchor falls back to 'top-left', a missing x or y to 0.
function scaleOrigin(d) {
  const anchor = ANCHORS.includes(d.anchor) ? d.anchor : 'top-left'
  const x = d.x ?? 0
  const y = d.y ?? 0
  const { top, outletEnd } = scaleLevels(d)
  if (anchor === 'inlet') return { left: x - d.width / 2, top: y - top }
  if (anchor === 'outlet') return { left: x - d.width / 2, top: y - outletEnd }
  return { left: x, top: y }
}

function ScaleShape({ dim: d, look, value, lamp }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const fillId = (part) => `${uid}-${part}`
  const { left, top: originTop } = scaleOrigin(d)
  const { top, bowlBottom, coneEnd, outletEnd } = scaleLevels(d)
  const W = d.width
  const cx = W / 2
  const t = d.tilt

  // The ellipses: the bowl's (rx), its open top inside the rim (ri), the
  // cone's bottom (r2) and the outlet's (ro), each r * tilt deep.
  const rx = W / 2
  const ry = rx * t
  const ri = Math.max(0, rx - d.rimWidth)
  const r2 = d.coneBottom / 2
  const ry2 = r2 * t
  const ro = d.outletWidth / 2

  // The cone's outline is the pair of lines that just touch the bowl's
  // bottom ellipse and the outlet's top one - their outer tangents once
  // squashed back into circles, at angle phi off the vertical - as the
  // silo's cone. Angles run round from its front (0), -90deg far left to
  // +90deg far right; what is in view lies between +/-reach.
  const phi = d.coneHeight > 0 ? Math.asin(Math.max(-1, Math.min(1, ((rx - r2) * t) / d.coneHeight))) : 0
  const reach = Math.PI / 2 - phi
  const bigAt = (a) => [cx + rx * Math.sin(a), bowlBottom + ry * Math.cos(a)]
  const smallAt = (a) => [cx + r2 * Math.sin(a), coneEnd + ry2 * Math.cos(a)]
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
      colour: shade(look.fill, plasticAt((Math.sin(mid) + 1) / 2) + CONE_DARKEN),
    }
  })
  const [lx, ly] = bigAt(-reach)
  const [rX, rY] = bigAt(reach)
  const [blx, bly] = smallAt(-reach)
  const [brx, bry] = smallAt(reach)
  const coneD = `M ${lx} ${ly} L ${blx} ${bly} A ${r2} ${ry2} 0 0 0 ${brx} ${bry} L ${rX} ${rY} A ${rx} ${ry} 0 0 1 ${lx} ${ly} Z`

  // A vertical cylinder's side, radius r from y0 down to y1: straight sides
  // and the front half of its bottom circle.
  const side = (r, y0, y1) =>
    `M ${cx - r} ${y0} L ${cx - r} ${y1} A ${r} ${r * t} 0 0 0 ${cx + r} ${y1} L ${cx + r} ${y0} Z`

  // The weight and lamp are placed down from the front of the cone's top,
  // where it meets the bowl, so they stay on the cone whatever the tilt.
  const coneFront = bowlBottom + ry
  const shown = value !== undefined && value !== null && value !== ''
  const lampColour = lamp === true ? look.lampOn : look.lampOff

  return (
    <g
      className="scale"
      transform={`translate(${left},${originTop})`}
      stroke={look.strokes === false ? 'none' : look.outline}
      strokeWidth={look.strokeWidth}
      strokeLinejoin="round"
    >
      <defs>
        {/* Across each cylinder, the silo's PLASTIC profile. */}
        <linearGradient id={fillId('metal')} x1="0" y1="0" x2="1" y2="0">
          {PLASTIC.map(([offset, amount]) => (
            <stop key={offset} offset={offset} stopColor={shade(look.fill, amount)} />
          ))}
        </linearGradient>
        {/* Down the cone, darkening towards the outlet. */}
        <linearGradient id={fillId('cone')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        {/*
          The inside, through the open top: the far wall lit, the floor
          towards the viewer in shadow under the near rim.
        */}
        <linearGradient id={fillId('inside')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(look.inside, 0.25)} />
          <stop offset="1" stopColor={shade(look.inside, -0.35)} />
        </linearGradient>
        {/* The lamp, a glossy dome: a highlight up and to the left. */}
        <radialGradient id={fillId('lamp')} cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor={shade(lampColour, 0.7)} />
          <stop offset="0.35" stopColor={lampColour} />
          <stop offset="1" stopColor={shade(lampColour, -0.45)} />
        </radialGradient>
      </defs>

      {/*
        Bottom up, so each part covers the one below where they meet: the
        outlet, its top behind the cone; the cone, its rim in front of the
        outlet's top; then the bowl, whose rounded bottom sits in front of
        the cone's top.
      */}
      <path className="scale-outlet" d={side(ro, coneEnd, outletEnd)} fill={`url(#${fillId('metal')})`} />
      <ellipse cx={cx} cy={coneEnd} rx={ro} ry={ro * t} fill={shade(look.fill, 0.1)} />

      <g className="scale-cone">
        <g stroke="none">
          {coneSlices.map(({ key, points, colour }) => (
            <polygon key={key} points={points} fill={colour} />
          ))}
          <path d={coneD} fill={`url(#${fillId('cone')})`} />
        </g>
        <path d={coneD} fill="none" />
      </g>

      <g className="scale-bowl">
        <path d={side(rx, top, bowlBottom)} fill={`url(#${fillId('metal')})`} />
        {/* The rim, lit as it faces up, and the inside within it. */}
        <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={shade(look.fill, 0.2)} />
        {ri > 0 && <ellipse cx={cx} cy={top} rx={ri} ry={ri * t} fill={`url(#${fillId('inside')})`} />}
      </g>

      {shown && (
        <text
          className="scale-value"
          x={cx + d.valueX}
          y={coneFront + d.valueY}
          textAnchor="middle"
          fontFamily={look.fontFamily}
          fontSize={d.fontSize}
          fontWeight={look.fontWeight}
          fill={look.text}
          stroke="none"
        >
          {value}
        </text>
      )}
      <circle
        className="scale-lamp"
        cx={cx + d.lampX}
        cy={coneFront + d.lampY}
        r={d.lampRadius}
        fill={`url(#${fillId('lamp')})`}
        stroke={look.strokes !== false && d.lampStroke > 0 ? look.lampOutline : 'none'}
        strokeWidth={d.lampStroke}
      />
    </g>
  )
}

/**
 * The scale and what a caller needs to place it, called as a function like
 * Silo():
 *
 *   const scale = Scale({ dim, look, value, lamp })
 *
 *   scale.element   the drawing, to put inside an <svg>
 *   scale.width     the bowl's width, or the outlet's if that is wider
 *   scale.height    the top of the bowl's rim to the front of the outlet's
 *                   bottom
 *
 * dim and look are laid over SCALE_DIM and SCALE_LOOK, so either can give
 * only what it changes - or every entry, to keep them all in one place.
 * No hooks run here - useId is in ScaleShape - so calling it like a plain
 * function is safe.
 */
function Scale({ dim, look, value, lamp = false } = {}) {
  const d = readDim(dim)
  const l = { ...SCALE_LOOK, ...look }
  return {
    element: <ScaleShape dim={d} look={l} value={value} lamp={lamp} />,
    width: Math.max(d.width, d.outletWidth),
    height: scaleLevels(d).height,
  }
}

export default Scale
