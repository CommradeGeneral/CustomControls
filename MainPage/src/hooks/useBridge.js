import { useEffect, useState } from 'react'

/**
 * Everything the container owns, in one place.
 *
 * The bridge is a plain object that WebCC mutates before React exists, and its
 * fields are not observable: code.js dispatches through `on*` callbacks that
 * have to be attached from inside an effect and detached on unmount. Gathering
 * all of that here keeps App a composition of panes rather than a hundred
 * lines of subscription bookkeeping.
 *
 * Carries Language, matching the contract in code.js. A further property or
 * method follows the same three steps as the one below: a piece of state, an
 * `on*` handler attached in the effect, and a line in the cleanup that
 * detaches it again. The cleanup is not optional - a handler left attached
 * after unmount calls setState on a dead component.
 *
 * Coercion belongs in code.js, not here. It is the half that talks to the
 * container and therefore the half that meets a marshalled INT arriving as
 * "2"; deciding what that means in two places is how the two come to disagree.
 *
 * `fire` is passed through rather than the bridge itself, so a caller cannot
 * reach past this into the container's plumbing.
 */
export function useBridge() {
  const bridge = window.MainBridge

  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(
    () => !bridge?.hasContainer || bridge?.connected === true)

  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')

  useEffect(() => {
    if (!bridge) return undefined

    // The handshake mutates plain fields, which React cannot observe; this is
    // the notification that lets the gate re-evaluate once it settles.
    bridge.onConnected = () => {
      setReady(!bridge.hasContainer || bridge.connected === true)
    }
    // Anything but 'ar' is English, including an absent or malformed value:
    // the manifest says so, and a container sending a language the control
    // does not have should get the default rather than an empty interface.
    bridge.onLanguage = (value) => {
      const next = typeof value === 'string' && value.toLowerCase() === 'ar' ? 'ar' : 'en'
      setLanguage(next)
    }

    // Anything dispatched before React mounted, replayed now that the
    // handlers exist.
    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onConnected = null
    }
  }, [bridge])

  return {
    ready,
    language,
    // Bound so callers need no reference to the bridge itself. Standalone is
    // detected inside fire(), which logs rather than throwing.
    fire: (name, payload) => bridge?.fire(name, payload),
  }
}
