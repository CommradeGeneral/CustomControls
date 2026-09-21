import { useEffect, useState } from 'react'

/**
 * Everything the container owns, in one place.
 *
 * The bridge is a plain object that WebCC mutates before React exists, and its
 * fields are not observable: code.js dispatches through `on*` callbacks that
 * have to be attached from inside an effect and detached on unmount. Gathering
 * all of that here keeps App a composition of cards rather than a screenful of
 * subscription bookkeeping.
 *
 * `fire` is passed through rather than the bridge itself, so a caller cannot
 * reach past this into the container's plumbing.
 */
export function useBridge() {
  const bridge = window.LoginBridge

  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(
    () => !bridge?.hasContainer || bridge?.connected === true)

  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')

  // Message shown under the sign-in button, raised by LoginMessage. `seq`
  // makes every call distinct, so re-sending the same code restarts the fade
  // rather than being ignored as equal state.
  //
  // Volatile by design: never written to a property or to browser storage, so
  // a recreated control comes up with no message and a stale error cannot
  // reappear over freshly entered credentials.
  const [loginMessage, setLoginMessage] = useState(null)

  useEffect(() => {
    if (!bridge) return undefined

    // The handshake mutates plain fields, which React cannot observe; this is
    // the notification that lets the gate re-evaluate once it settles.
    bridge.onConnected = () => {
      setReady(!bridge.hasContainer || bridge.connected === true)
    }
    bridge.onLanguage = (value) => {
      // The container may hand over an empty or unknown value before the tag
      // is resolved; keep the last good language rather than blanking every
      // label on the card.
      const code = typeof value === 'string' ? value.trim().toLowerCase() : ''
      if (code === 'en' || code === 'ar') setLanguage(code)
    }
    bridge.onLoginMessage = ({ code, duration }) => {
      setLoginMessage((previous) => ({
        code, duration, seq: (previous?.seq ?? 0) + 1,
      }))
    }

    // Anything dispatched before React mounted, replayed now that the
    // handlers exist.
    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onLoginMessage = null
      bridge.onConnected = null
    }
  }, [bridge])

  return {
    ready,
    language,
    loginMessage,
    // Bound so callers need no reference to the bridge itself. Standalone is
    // detected inside fire(), which logs rather than throwing.
    fire: (name, payload) => bridge?.fire(name, payload),
  }
}
