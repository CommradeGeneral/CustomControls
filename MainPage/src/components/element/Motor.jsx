import { useEffect, useId, useRef } from 'react'
import { PLASTIC, shade } from './Silo'
import './Motor.css'

/**
 * A three-phase induction motor (TEFC, foot mounted), seen from the side, as
 * an SVG group. Rendered through Motor() below, which pairs it with its size.
 *
 * Draws a <g>, not an <svg>, like the silo, so it shares the caller's canvas
 * and coordinate system.
 *
 * Laid out shaft to the right: the fan cover at the non-drive end, the finned
 * frame with the terminal box on top and the feet below, the drive-end
 * shield, then the shaft. `dim.shaft` 'left' mirrors it.
 *
 *   dim   x, y and anchor place it - 'top-left' (the default); 'shaft',
 *         the tip of the shaft on its axis; or 'shaft-top', x at the
 *         shaft's tip and y at the motor's top; length (the frame, fan cover and
 *         shield excluded), diameter, shaft ('left' or 'right'),
 *         shaftLength (from the shield to the tip; a quarter of length
 *         if not given)
 *   look  on, off, fault - the body's base colour while running, while
 *         stopped, and while overloaded
 *         (green, grey and red if not given), shaded as plastic like the silo
 *         (PLASTIC); outline - the stroke, 'none' to hide it
 *   running, overload
 *             what the motor is doing, as two separate bits - anything but
 *             true is taken as false:
 *               neither            grey
 *               running            green, rotor turning
 *               overload           red, pulsing brighter and back, with the
 *                                  danger sign
 *               running, overload  red changing to green and back on the
 *                                  same beat, with the danger sign, rotor
 *                                  turning
 *             Running also lights the lamp on the terminal box.
 *   onClick, onDoubleClick
 *             a click and a double-click on the motor - only ever one of the
 *             two per gesture. With onDoubleClick given, a click waits
 *             DOUBLE_CLICK ms for a second one before it counts as a click; a
 *             double-click cancels it. Without it, a click acts at once.
 *   speed     how fast the rotor turns while running, in turns per second
 *             (1 if not given; 0 holds it still). It spins up to it and
 *             down to a stop at a steady rate rather than jumping, each
 *             taking RAMP.
 *
 * The rotor is seen by its shaft: stripes along it and the key on it, which
 * travel round with it - up over the top, down across the front, and behind.
 */

// Shares of the frame's length or diameter, for everything hung off it.
const FAN_COVER = 0.28 // length, of the frame's
const FAN_COVER_D = 0.9 // diameter, of the frame's
const SHIELD = 0.08 // the drive-end shield's length, of the frame's
const SHIELD_D = 0.78
const SHAFT = 0.25 // length, of the frame's
const SHAFT_D = 0.2
const BOX_W = 0.36 // the terminal box, of the frame's length
const BOX_H = 0.22 // of the diameter
const FOOT_H = 0.14 // of the diameter
// The body's colours for running, stopped and overloaded, when look does not
// give them.
const ON = '#3fae5a'
const OFF = '#9aa1a8'
const FAULT = '#d63a2f'

// How long a click waits for a second before it counts as a single click,
// in ms. A second click later than this is ignored, not taken as a double
// - the click has already acted - so the two never both fire.
const DOUBLE_CLICK = 300

// How long the rotor takes to spin up from rest to its speed, and to stop
// from it, in seconds - the same both ways, at a steady rate.
const RAMP = 0.4
// Marks painted along the shaft, evenly round it, so its turning shows.
const STRIPES = 3
// The key's steel, shaded per face by which way the face points (keyView).
const KEY = '#9aa1a9'
// The key's faces: its outer face, pointing out from the shaft, and its two
// flanks, pointing either way round it.
const KEY_FACES = ['outer', 'flank+', 'flank-']
// How deep the key sits in its keyway, as a share of its height: the part
// below the shaft's surface is hidden in the groove, and sinking it keeps
// the key visibly seated in the shaft at every angle rather than standing
// on it.
const KEY_SEAT = 0.3

// The key is seen from a little above, as the silo is (its TILT): enough to
// show the key's top as well as its flank when it stands upright, so it
// reads as a block. The shaft is round, so looks the same either way.
const KEY_VIEW = Math.asin(0.25)
const screen = [Math.cos(KEY_VIEW), Math.sin(KEY_VIEW)]
const eye = [-Math.sin(KEY_VIEW), Math.cos(KEY_VIEW)]
const dot = (p, q) => p[0] * q[0] + p[1] * q[1]

// The key at angle a round the shaft, as seen: a block keyW wide and keyH
// tall, seated KEY_SEAT deep in the shaft (radius r). Directions are (y, z)
// across the shaft: y down, z out towards the viewer. The key points out
// along u; its flanks face either way along t, round the shaft. Seen from
// KEY_VIEW above, a point's height on screen is along `screen`, and a face
// shows if it points towards `eye`.
//
// Returns, with every y relative to the shaft's axis:
//   faces  each face's span on screen, whether it shows, and its colour - lit
//          from above and a little from the front, like the rest of the motor
//   seams  where each flank meets the shaft, for the dark line of the
//          keyway's edge there, and whether that flank shows
//   ridge  the outer face's upper edge, which catches the light, and how
//          strongly - most when the key points up
//   foot   the lowest point of the key on the shaft, where its shadow starts
function keyView(a, r, keyW, keyH) {
  const u = [Math.sin(a), Math.cos(a)]
  const t = [Math.cos(a), -Math.sin(a)]
  const base = r - keyH * KEY_SEAT
  const at = (side, out) => {
    const reach = base + out * keyH
    return dot([reach * u[0] + side * (keyW / 2) * t[0], reach * u[1] + side * (keyW / 2) * t[1]], screen)
  }
  const shows = (normal) => dot(normal, eye) > 0.02
  const face = (normal, y0, y1) => ({
    top: Math.min(y0, y1),
    height: Math.abs(y1 - y0),
    visible: shows(normal),
    colour: shade(KEY, -0.45 * normal[0] + 0.2 * normal[1] - 0.05),
  })
  // Where the flanks leave the shaft's surface: not at radius r, as a flank
  // is keyW / 2 off the key's centre line, and a round shaft's surface is
  // that much lower there. Taking r would leave a gap under the key where it
  // is seen past the shaft's edge.
  const seat = (Math.sqrt(Math.max(0, r * r - (keyW / 2) ** 2)) - base) / keyH
  const minusT = [-t[0], -t[1]]
  return {
    faces: [
      face(u, at(-1, 1), at(1, 1)),
      face(t, at(1, seat), at(1, 1)),
      face(minusT, at(-1, seat), at(-1, 1)),
    ],
    seams: [
      { y: at(1, seat), visible: shows(t) },
      { y: at(-1, seat), visible: shows(minusT) },
    ],
    ridge: {
      y: Math.min(at(-1, 1), at(1, 1)),
      strength: shows(u) || shows(t) || shows(minusT) ? 0.35 + 0.45 * Math.max(0, -u[0]) : 0,
    },
    foot: Math.max(at(-1, seat), at(1, seat)),
  }
}

// The cooling fins run the frame's length; this many across its height.
const FINS = 7

// A motor's parts, in its own units with the shaft on the right.
function motorGeometry(dim) {
  const L = dim.length
  const D = dim.diameter
  const fc = L * FAN_COVER
  const sh = L * SHIELD
  const shaft = dim.shaftLength ?? L * SHAFT
  const box = D * BOX_H
  return {
    L, D, fc, sh, shaft, box,
    // The key keeps its place by the shield however long the shaft is.
    key: L * SHAFT,
    foot: D * FOOT_H,
    width: fc + L + sh + shaft,
    height: box + D + D * FOOT_H,
  }
}

// The motor's top-left corner, from dim.x / dim.y and the point they locate:
// with 'shaft', (x, y) is the shaft's tip on its axis, for coupling the motor
// to whatever it drives; 'shaft-top' is the same across, but y is the top.
function motorOrigin(dim) {
  const x = dim.x ?? 0
  const y = dim.y ?? 0
  if (dim.anchor !== 'shaft' && dim.anchor !== 'shaft-top') return { left: x, top: y }
  const { width, box, D } = motorGeometry(dim)
  return {
    left: dim.shaft === 'left' ? x : x - width,
    top: dim.anchor === 'shaft' ? y - box - D / 2 : y,
  }
}

function MotorShape({ dim, look, running, overload, speed, onClick, onDoubleClick }) {
  const { L, D, fc, sh, shaft, key, box, foot, width } = motorGeometry(dim)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const fillId = (part) => `${uid}-${part}-fill`

  // The axis every round part is centred on.
  const cy = box + D / 2
  const frameX = fc
  const shieldX = fc + L
  const shaftX = shieldX + sh
  const fcD = D * FAN_COVER_D
  const shD = D * SHIELD_D
  const sfD = D * SHAFT_D

  // The rotor, turned frame by frame. The angle is 0 with a stripe facing the
  // viewer; the key starts on top, where the drawing stood it before it
  // turned. Angle and speed live in refs and the parts are moved by setting
  // their attributes directly, so turning re-renders nothing.
  const r = sfD / 2
  const keyH = sfD * 0.3
  const keyW = sfD * 0.45
  const stripeW = sfD * 0.12
  const stripes = useRef([])
  // The key, drawn twice: behind the shaft and in front of it. Each layer
  // holds its faces, its seams and its ridge; the shadow is only ever on
  // the shaft's front.
  const keyBack = useRef({ faces: [], seams: [] })
  const keyFront = useRef({ faces: [], seams: [] })
  const keyShadow = useRef(null)
  const angle = useRef(0)
  const turning = useRef(0)
  const target = running ? Math.max(0, speed) : 0
  useEffect(() => {
    // Places the rotor's marks at the current angle. A mark at angle a round
    // the shaft sits r * sin(a) below the axis and faces the viewer by
    // cos(a): narrower towards the edges, gone once it is round the back.
    const place = () => {
      const a0 = angle.current
      stripes.current.forEach((el, k) => {
        if (!el) return
        const a = a0 + (2 * Math.PI * k) / STRIPES
        const c = Math.cos(a)
        const h = stripeW * Math.max(0, c)
        el.setAttribute('y', cy + r * Math.sin(a) - h / 2)
        el.setAttribute('height', h)
        el.setAttribute('opacity', c > 0 ? 1 : 0)
      })
      // The key, as a solid block: each face that points towards the viewer,
      // shaded by the way it points, so as it turns its top, flank and outer
      // face take the light in turn. On the shaft's far half it is drawn in
      // the layer behind the shaft, which hides what the shaft is in front of.
      const a = a0 - Math.PI / 2
      const front = Math.cos(a) >= 0
      const view = keyView(a, r, keyW, keyH)
      const set = (el, attrs) => {
        if (el) for (const name in attrs) el.setAttribute(name, attrs[name])
      }
      const seamH = keyH * 0.14
      for (const [layer, show] of [[keyFront.current, front], [keyBack.current, !front]]) {
        view.faces.forEach((f, i) =>
          set(layer.faces[i], { y: cy + f.top, height: f.height, fill: f.colour, opacity: show && f.visible ? 1 : 0 }))
        view.seams.forEach((seam, i) =>
          set(layer.seams[i], { y: cy + seam.y - seamH / 2, height: seamH, opacity: show && seam.visible ? 0.55 : 0 }))
        set(layer.ridge, { y: cy + view.ridge.y, height: keyH * 0.1, opacity: show ? view.ridge.strength : 0 })
      }
      // The key's shadow on the shaft, falling down from its foot - lit from
      // above - as far as the shaft's lower edge. Strongest facing the viewer.
      const shadowTop = cy + view.foot
      const shadowH = Math.max(0, Math.min(keyH * 0.6, cy + r - shadowTop))
      set(keyShadow.current, { y: shadowTop, height: shadowH, opacity: front ? 0.3 * Math.cos(a) : 0 })
    }
    place()
    // Nothing to animate: stopped, and already at rest.
    if (target === 0 && turning.current === 0) return
    let frame
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      // Steps towards the target speed at the rate that covers the larger of
      // the two in RAMP: from rest up to speed, or from speed down to rest,
      // take the same time. Stops exactly on it rather than overshooting.
      const rate = Math.max(target, turning.current) / RAMP
      const gap = target - turning.current
      turning.current += Math.sign(gap) * Math.min(Math.abs(gap), rate * dt)
      angle.current = (angle.current + 2 * Math.PI * turning.current * dt) % (2 * Math.PI)
      place()
      if (turning.current !== 0 || target !== 0) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, cy, r, keyH, keyW, stripeW])

  // A click, held back until it is clear it is not the start of a
  // double-click. `clicked` notes that the held click went through, so a
  // late second click that the browser still calls a double-click is
  // dropped rather than firing as well.
  const clickTimer = useRef(null)
  const clicked = useRef(false)
  useEffect(() => () => clearTimeout(clickTimer.current), [])
  const handleClick = (e) => {
    if (!onDoubleClick) return onClick?.(e)
    // detail counts the clicks in a run; only the first starts the wait.
    if (e.detail !== 1) return
    clicked.current = false
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      clicked.current = true
      onClick?.(e)
    }, DOUBLE_CLICK)
  }
  const handleDoubleClick = (e) => {
    if (clicked.current) return
    clearTimeout(clickTimer.current)
    clickTimer.current = null
    onDoubleClick?.(e)
  }

  // Mirrored for a shaft on the left: the whole group flips about its middle,
  // so left and top still name its top-left corner.
  const flip = dim.shaft === 'left'
  const { left, top } = motorOrigin(dim)
  const transform = flip
    ? `translate(${left + width},${top}) scale(-1,1)`
    : `translate(${left},${top})`

  // The body shows whether the motor runs.
  const body = overload ? look.fault ?? FAULT : running ? look.on ?? ON : look.off ?? OFF

  // A horizontal cylinder: lit from above, so PLASTIC runs top to bottom.
  const gradients = [
    ['frame', body],
    ['cover', shade(body, -0.06)],
    ['steel', '#b8bec6'],
    // Running and overloaded: the pulse towards running green, shaded like
    // the body.
    ['running', look.on ?? ON],
  ]

  const fins = Array.from({ length: FINS }, (_, i) => box + (D * (i + 1)) / (FINS + 1))
  const finW = Math.max(0.4, D * 0.02)
  // Vent slots in the fan cover's side.
  const slots = 4
  const slotX = (i) => fc * 0.2 + ((fc * 0.6) * i) / (slots - 1)
  // Where the key lies along the shaft, by the shield.
  const keyX = shaftX + key * 0.35
  const keyL = key * 0.45

  // Overloaded, each part of the body pulses: the part's shape again, laid
  // straight over it - under its details (slots, fins, nameplate, lamp), so
  // they stay in view - and faded in and out by Motor.css. Stopped, a
  // bright red, so the red brightens and dims; running, the running
  // green, shaded like the body, faded fully in, so the colour changes
  // between red and green - overloaded, and still running. `dark` is for
  // the feet, which sit in shadow.
  const flash = (shape, dark = false) =>
    overload && (
      <rect
        className="motor-overload-flash"
        {...shape}
        fill={running
          ? dark ? shade(look.on ?? ON, -0.3) : `url(#${fillId('running')})`
          : dark ? shade('#ff8a7a', -0.3) : '#ff8a7a'}
        stroke="none"
      />
    )
  const feet = [
    { x: frameX + L * 0.08, y: cy, width: L * 0.18, height: D / 2 + foot },
    { x: frameX + L * 0.74, y: cy, width: L * 0.18, height: D / 2 + foot },
    { x: frameX, y: box + D + foot * 0.4, width: L, height: foot * 0.6, rx: foot * 0.2 },
  ]
  const shieldShape = { x: shieldX - 1, y: cy - shD / 2, width: sh + 1, height: shD, rx: sh * 0.5 }
  const coverShape = { x: 0, y: cy - fcD / 2, width: fc + 1, height: fcD, rx: fc * 0.3 }
  const frameShape = { x: frameX, y: box, width: L, height: D, rx: D * 0.06 }
  const boxShape = { x: frameX + (L - L * BOX_W) / 2, y: 0, width: L * BOX_W, height: box + 1, rx: box * 0.15 }

  return (
    <g
      className={`motor${onClick || onDoubleClick ? ' clickable' : ''}${overload ? ' overload' : ''}${overload && running ? ' driven' : ''}`}
      transform={transform}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      stroke={look.outline} strokeLinejoin="round">
      <defs>
        {gradients.map(([part, colour]) => (
          <linearGradient key={part} id={fillId(part)} x1="0" y1="0" x2="0" y2="1">
            {PLASTIC.map(([offset, amount]) => (
              <stop key={offset} offset={offset} stopColor={shade(colour, amount)} />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* Feet and base, behind the frame so its round underside sits on them. */}
      <g fill={shade(body, -0.3)}>
        {feet.map((shape, i) => <rect key={i} {...shape} />)}
      </g>
      {feet.map((shape, i) => <g key={i}>{flash(shape, true)}</g>)}

      {/*
        The shaft, with its key and stripes - the rotor. The key's faces are
        drawn twice, behind the shaft and in front, and shown in whichever it
        is on as it turns; the effect above places them, the stripes and the
        key's shadow on the shaft.
      */}
      <g className="motor-rotor" stroke="none">
        <g className="motor-key">
          {KEY_FACES.map((face, i) => (
            <rect key={face} ref={(el) => { keyBack.current.faces[i] = el }} x={keyX} width={keyL} />
          ))}
          {[0, 1].map((i) => (
            <rect key={i} ref={(el) => { keyBack.current.seams[i] = el }} x={keyX} width={keyL} fill="#000" />
          ))}
          <rect ref={(el) => { keyBack.current.ridge = el }} x={keyX + keyL * 0.04} width={keyL * 0.92} fill="#fff" />
        </g>
        <rect x={shaftX - 1} y={cy - r} width={shaft + 1} height={sfD} fill={`url(#${fillId('steel')})`} />
        {Array.from({ length: STRIPES }, (_, k) => (
          <rect
            key={k}
            ref={(el) => { stripes.current[k] = el }}
            x={shaftX}
            width={shaft}
            fill="#000"
            fillOpacity={0.3}
          />
        ))}
        <rect ref={keyShadow} x={keyX - keyL * 0.02} width={keyL * 1.06} fill="#000" />
        <g className="motor-key">
          {KEY_FACES.map((face, i) => (
            <rect key={face} ref={(el) => { keyFront.current.faces[i] = el }} x={keyX} width={keyL} />
          ))}
          {[0, 1].map((i) => (
            <rect key={i} ref={(el) => { keyFront.current.seams[i] = el }} x={keyX} width={keyL} fill="#000" />
          ))}
          <rect ref={(el) => { keyFront.current.ridge = el }} x={keyX + keyL * 0.04} width={keyL * 0.92} fill="#fff" />
        </g>
      </g>

      {/* Drive-end shield. */}
      <rect {...shieldShape} fill={`url(#${fillId('cover')})`} />
      {flash(shieldShape)}

      {/* Fan cover, its back end rounded. */}
      <rect {...coverShape} fill={`url(#${fillId('cover')})`} />
      {flash(coverShape)}
      <g stroke="#000" strokeOpacity={0.35} strokeWidth={Math.max(0.5, fc * 0.06)} strokeLinecap="round">
        {Array.from({ length: slots }, (_, i) => (
          <line key={i} x1={slotX(i)} y1={cy - fcD * 0.32} x2={slotX(i)} y2={cy + fcD * 0.32} />
        ))}
      </g>

      {/* Frame, then its fins: a groove with a highlight under it, as the silo's seams. */}
      <rect {...frameShape} fill={`url(#${fillId('frame')})`} />
      {flash(frameShape)}
      <g stroke="none">
        {fins.map((y) => (
          <g key={y}>
            <rect x={frameX + L * 0.02} y={y - finW / 2} width={L * 0.96} height={finW} fill="#000" fillOpacity={0.28} />
            <rect x={frameX + L * 0.02} y={y + finW / 2} width={L * 0.96} height={finW * 0.7} fill="#fff" fillOpacity={0.45} />
          </g>
        ))}
      </g>

      {/* Nameplate. */}
      <rect x={frameX + L * 0.38} y={cy + D * 0.1} width={L * 0.24} height={D * 0.2} rx={0.5} fill="#e6e9ec" stroke="#6b7280" strokeWidth={0.3} />

      {/* Terminal box, with the run lamp. */}
      <rect {...boxShape} fill={`url(#${fillId('cover')})`} />
      {flash(boxShape)}
      <circle
        className="motor-lamp"
        cx={frameX + L / 2}
        cy={box * 0.5}
        r={box * 0.25}
        fill={running ? '#22c55e' : '#9ca3af'}
        stroke="#1f2933"
        strokeWidth={0.3}
      />

      {/*
        The electrical danger sign, over the fan cover's end, away from the
        silo: a yellow triangle with a black border and a lightning bolt,
        flashing (Motor.css). The motor group may be mirrored; the sign is
        mirrored back about its own middle, so the bolt always reads the
        right way round.
      */}
      {overload && (() => {
        const size = D * 0.55
        const sx = fc / 2
        const sy = -size * 0.95
        return (
          <g
            className="motor-danger"
            transform={`translate(${sx},${sy})${flip ? ' scale(-1,1)' : ''} scale(${size / 24})`}
            stroke="none"
          >
            <title>Overload</title>
            <path d="M12 1.5 L23 21 Q23.4 22.5 21.8 22.5 L2.2 22.5 Q0.6 22.5 1 21 Z" fill="#111" transform="translate(-12,0)" />
            <path d="M12 4.6 L20.6 20.3 L3.4 20.3 Z" fill="#facc15" transform="translate(-12,0)" />
            <path d="M13.2 7.5 L8.6 14.6 L11.6 14.6 L10.4 19.2 L15.4 11.8 L12.3 11.8 Z" fill="#111" transform="translate(-12,0)" />
          </g>
        )
      })()}
    </g>
  )
}

/**
 * The motor and what a caller needs to place it, called as a function like
 * Silo():
 *
 *   const motor = Motor({ dim, look, running, overload, speed, onClick, onDoubleClick })
 *
 *   motor.element   the drawing, to put inside an <svg>
 *   motor.width     total width, fan cover to shaft tip
 *   motor.height    total height, terminal box to feet
 *   motor.axis      from the top down to the shaft's axis
 *
 * No hooks run here - useId is in MotorShape - so calling it like a plain
 * function is safe.
 */
function Motor({ dim, look, running = false, overload = false, speed = 1, onClick, onDoubleClick }) {
  const { width, height, box, D } = motorGeometry(dim)
  return {
    element: (
      <MotorShape
        dim={dim}
        look={look}
        running={running === true}
        overload={overload === true}
        speed={speed}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    ),
    width,
    height,
    axis: box + D / 2,
  }
}

export default Motor
