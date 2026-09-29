import Silo, { siloOutlet } from './Silo'
import Motor from './Motor'

/**
 * A silo with its drive motor, as one element: placed, moved and sized by the
 * silo's `dim` alone, with the motor standing beside the hopper's outlet -
 * its top level with the outlet's top, where the cone ends, its body `gap`
 * clear of the outlet's side and its shaft running on in behind the outlet
 * to its middle.
 *
 * Called as a function like Silo(), and returns the same fields:
 *
 *   const unit = SiloUnit({ dim, look, warnings, title, values, onIconClick,
 *                           onSiloClick, motor, motorRunning, motorOverload,
 *                           speed, onMotorClick, onMotorDoubleClick })
 *
 *   dim, look, warnings, title, values, onIconClick, onSiloClick
 *            the silo's - see Silo
 *   motor    the motor's own settings: length, diameter, side ('right', the
 *            default, or 'left' - which side of the outlet it stands),
 *            gap (clear space between the outlet and the motor's shaft
 *            at its usual length), look
 *   motorRunning, motorOverload, speed, onMotorClick, onMotorDoubleClick
 *            the motor's two state bits - whether it runs and whether it is
 *            overloaded, see Motor's running and overload - how fast its
 *            rotor turns (turns per second), and what a click and a
 *            double-click on it do
 *
 *   unit.element   both drawings in one <g>, to put inside an <svg>
 *   unit.width     from the leftmost to the rightmost of either
 *   unit.height    the silo's own height - the motor stands within it
 *   unit.above     room the silo's icon row and title need above its top
 */

const MOTOR = { length: 34, diameter: 22, side: 'right', gap: 2, look: { outline: 'none' } }

function SiloUnit({ motor: motorSettings, motorRunning = false, motorOverload = false, speed, onMotorClick, onMotorDoubleClick, ...siloProps }) {
  const { dim } = siloProps
  const m = { ...MOTOR, ...motorSettings }
  const silo = Silo(siloProps)

  // The shaft is its usual quarter of the motor's length, plus the gap and
  // half the outlet's width, so the body stays put and the tip reaches the
  // outlet's middle - hidden, as the motor is drawn behind the silo.
  const motorDim = {
    shaftLength: m.length * 0.25 + m.gap + dim.w2 / 2,
    length: m.length,
    diameter: m.diameter,
    shaft: m.side === 'left' ? 'right' : 'left',
  }
  // The outlet's top - where the cone ends - which the motor's top is
  // level with, beside the outlet and below the cone, so clear of both.
  const outlet = siloOutlet(dim)
  const outletTop = outlet.y - dim.h4
  const motor = Motor({
    dim: { ...motorDim, x: outlet.x, y: outletTop, anchor: 'shaft-top' },
    look: m.look,
    running: motorRunning,
    overload: motorOverload,
    speed,
    onClick: onMotorClick,
    onDoubleClick: onMotorDoubleClick,
  })

  // How far the motor reaches past the silo's side, if at all: it starts at
  // the outlet's middle, the silo's.
  const reach = motor.width - dim.siloWidth / 2
  return {
    element: (
      <g className="silo-unit">
        {motor.element}
        {silo.element}
      </g>
    ),
    width: silo.width + Math.max(0, reach),
    height: silo.height,
    above: silo.above,
  }
}

export default SiloUnit
