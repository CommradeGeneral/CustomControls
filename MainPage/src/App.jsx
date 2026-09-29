import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useBridge } from './hooks/useBridge'
import SiloUnit from './components/element/SiloUnit'
import Scale from './components/element/Scale'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import './index.css'
import './App.css'

/**
 * The control.
 *
 * An empty shell. What is here is the part every version of this control needs
 * however its UI turns out - the handshake gate, the document's reading
 * direction, and the container the layout hangs off - so it is the frame
 * rather than a draft to be argued with.
 *
 * Holds no state of its own, and should not grow any: everything the container
 * owns belongs in useBridge, so what remains here is the wiring and the layout.
 *
 * ---------------------------------------------------------------------------
 * What the contract currently carries
 * ---------------------------------------------------------------------------
 *
 * One method and one property, so useBridge returns:
 *
 *   ready, language, fire
 *
 * Print is deliberately invisible here: it logs to the console and the status
 * line without touching React, which is what makes it a test of the
 * container -> control direction on its own.
 *
 * Adding anything to the contract means four places, and missing one is the
 * usual bug: manifest.json declares it, code.js implements it and dispatches
 * it, useBridge holds it as state and attaches an `on*` handler for it, and
 * this component reads it. An event needs the first two and `fire`.
 */
function App() {
  const { ready, language, fire } = useBridge()

  // The document, not the control: an RTL language has to reach the root for
  // scrollbars and text selection to follow it, which a nested dir cannot do.
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  // How many divisions the block is drawn with. State rather than a constant
  // because the count is the thing that will change - from a control, or from
  // a property the container sets - and the drawing is derived from it.
  const [dim, setDim] = useState({
    lines: 1,
    siloWidth: 80,
    h1: 120,
    h2: 25,
    h3: 30,
    h4: 30,
    w2: 20,
    lineCount: 6,
    // How far down on the silo it is seen: each horizontal circle's depth
    // as a share of its width - 0 is flat 2D, 0.25 the default.
    tilt: 0.05,
    // Where the silo is placed: (x, y) is the position of the `anchor` -
    // a corner, 'top-left', 'top-right', 'bottom-left' or 'bottom-right',
    // or 'outlet', the centre of the hopper's exit.
    // y leaves room above the roof for the icon row.
    x: 0,
    y: 60,
    anchor: 'top-left',
    labelGap: 10
  })

  const lookColor = '#b6d600'

  // How each part is painted: a flat fill per part, and `outline` is the stroke - 'none' hides it,
  // a colour such as '#2f3a45' brings it back.
  const [look, setLook] = useState({
    body: lookColor,
    roof: '#258c50',
    hopper: lookColor,
    outline: 'none',
  })

  // Badged on the silo's warning icon; 0 hides the badge.
  const [warnings, setWarnings] = useState(0)

  // What the motor is doing, as two separate bits: whether it runs, and
  // whether it is overloaded (Motor's running and overload).
  const [motorRunning, setMotorRunning] = useState(true)
  const [motorOverload, setMotorOverload] = useState(false)
  // How fast the motor's rotor turns while running, in turns per second;
  // 0 holds it still. It ramps to a new value rather than jumping.
  const [speed, setSpeed] = useState(20)

  // The silo and its motor as one element, placed by the silo's `dim`: the
  // motor stands beside the hopper's outlet wherever the silo goes.
  // Placeholder: each icon's action is decided here, by name.
  const unit = SiloUnit({
    dim,
    look,
    warnings,
    title: 'أسمنت',
    values: [
      // Required, then served.
      { value: '1234.56', unit: 'kg' },
      { value: '987.65', unit: 'kg' },
    ],
    onIconClick: (name) => setWarnings((v) => v + 1),
    onSiloClick: () => setWarnings((v) => v > 0 ? v - 1 : 0),
    motor: { length: 25, diameter: 20, side: 'right' },
    motorRunning,
    motorOverload,
    speed: 3,
    onMotorClick: () => console.log("single"),
    // Tells the container which unit's motor was double-clicked, by its title.
    onMotorDoubleClick: () => setMotorRunning((v)=>!v),
  })

  // The scale, a separate element from the silo: placed by its own x, y and
  // anchor ('top-left', 'inlet' or 'outlet' - see Scale), not by the silo's.
  // Every size is listed so each can be edited here; one left out takes
  // Scale's SCALE_DIM default.
  const [scaleDim, setScaleDim] = useState({
    x: 200,
    y: 80,
    anchor: 'top-left',
    width: 500,
    bowlHeight: 70,
    // The rim round the bowl's open top.
    rimWidth: 10,
    coneHeight: 30,
    // The cone's width where it meets the outlet.
    coneBottom: 120,
    outletWidth: 140,
    outletHeight: 20,
    // How far down on it it is seen: each circle's depth as a share of its
    // width - 0 is flat 2D, the silo uses 0.25. A wide, shallow cone needs
    // less, or it is hidden behind the bowl's rounded bottom.
    tilt: 0.03,
    // The weight's text: its size, and its centre across from the middle
    // and baseline down from the front of the cone's top.
    fontSize: 10,
    valueX: 0,
    valueY: 10,
    // The lamp: its radius, its centre across from the middle and down
    // from the front of the cone's top, and its outline width (0 hides it).
    lampRadius: 3.5,
    lampX: 0,
    lampY: 18,
    lampStroke: 0,
  })
  // How the scale is painted - see Scale's SCALE_LOOK.
  const [scaleLook, setScaleLook] = useState({
    fill: '#c9c3b8',
    // The bowl's inside, seen through its open top.
    inside: '#9b8e74',
    // false hides every stroke - the outline and the lamp's.
    strokes: false,
    outline: '#5b636b',
    strokeWidth: 0.0,
    text: '#000',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 700,
    lampOn: '#e02020',
    lampOff: '#9ca3af',
    lampOutline: '#000',
  })
  // The weight shown on the cone, and whether the lamp is lit.
  const [scaleValue, setScaleValue] = useState(0)
  const [scaleLamp, setScaleLamp] = useState(true)
  const scale = Scale({
    dim: scaleDim,
    look: scaleLook,
    value: scaleValue,
    lamp: scaleLamp,
  })

  // Inside a container, nothing is rendered until the handshake succeeds: the
  // UI would otherwise flash default property values before TIA supplies the
  // real ones. Standalone there is nothing to wait for, so `ready` starts true.
  if (!ready) return null

  return (
    <div className="main-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/*
        Pan and zoom: wheel or pinch to zoom in, then drag to move about.
        limitToBounds keeps the drawing filling the view, so at its fitted
        size (minScale 1) there is nothing to drag; double-click zoom is off
        because the silo takes clicks itself.
      */}

      <TransformWrapper minScale={1} maxScale={100} limitToBounds={true} doubleClick={{ disabled: true }}>
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div className='svg-container' style={{ background: '#d6bebea6' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${1920} ${1080}`} style={{ display: 'block' }}>
              {unit.element}
              {scale.element}
            </svg>
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
