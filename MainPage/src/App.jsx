import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useBridge } from './hooks/useBridge'
import Silo from './components/element/Silo'
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
  const { ready, language } = useBridge()

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
    siloWidth: 60,
    h1: 120,
    h2: 30,
    h3: 30,
    h4: 20,
    w2: 10,
    lineCount: 10,
    // Where the silo is placed: (x, y) is the position of the `anchor` -
    // a corner, 'top-left', 'top-right', 'bottom-left' or 'bottom-right',
    // or 'outlet', the centre of the hopper's exit.
    // y leaves room above the roof for the icon row.
    x: 0,
    y: 0,
    anchor: 'top-left'
  })

  const lookColor = '#abf5b1'

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

  // Placeholder: each icon's action is decided here, by name.
  const silo = Silo({
    dim,
    look,
    warnings,
    title: 'Cement with chemical additions',
    values: ['1234.56 kg', '1234.56 kg'],
    onIconClick: (name) => setWarnings((v)=> v+1),
    onSiloClick: ()=> setWarnings((v)=> v > 0? v-1: 0)
  })

  // Inside a container, nothing is rendered until the handshake succeeds: the
  // UI would otherwise flash default property values before TIA supplies the
  // real ones. Standalone there is nothing to wait for, so `ready` starts true.
  if (!ready) return null

  return (
    <div className="main-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <svg width="100%" viewBox="0 0 250 250" style={{ display: 'block' }}>
        {silo.element}
      </svg>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
