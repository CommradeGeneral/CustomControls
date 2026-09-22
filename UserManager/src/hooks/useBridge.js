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
 * Carries Language, Username and Role, matching the contract in code.js. A
 * further property or method follows the same three steps as the ones below:
 * a piece of state, an `on*` handler attached in the effect, and a line in the
 * cleanup that detaches it again. The cleanup is not optional - a handler left
 * attached after unmount calls setState on a dead component.
 *
 * Coercion belongs in code.js, not here. It is the half that talks to the
 * container and therefore the half that meets a marshalled INT arriving as
 * "2"; deciding what that means in two places is how the two come to disagree.
 *
 * `fire` is passed through rather than the bridge itself, so a caller cannot
 * reach past this into the container's plumbing.
 */
export function useBridge() {
  const bridge = window.UserBridge

  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(
    () => !bridge?.hasContainer || bridge?.connected === true)

  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  // Who the container says is signed in, and what they may do. code.js
  // normalizes both before dispatching, so these are seeded from the bridge
  // as-is rather than re-coercing here - one place decides what a malformed
  // value means, and it is the one the container talks to.
  const [username, setUsername] = useState(() => bridge?.username ?? '')
  const [role, setRole] = useState(() => bridge?.role ?? 0)
  // Outcome of a change-password attempt, raised by ChangePasswordMessage.
  // `seq` makes every call distinct, so re-sending the same code restarts the
  // countdown rather than being ignored as equal state.
  //
  // Volatile by design: never written to a property or to storage, so a
  // recreated control comes up with no message.
  const [passwordMessage, setPasswordMessage] = useState(null)
  // Outcome of a create attempt on the new-user row, raised by AddUserMessage.
  // Same seq contract as the password message.
  const [addUserMessage, setAddUserMessage] = useState(null)
  // The accounts the Users section lists. Null is "never answered", which the
  // section shows as loading; an empty array is a real answer with no rows.
  const [users, setUsers] = useState(() => bridge?.users ?? null)
  // What the list shows in place of rows: -1 not asked, 0 loaded, and 1/2/3
  // the failures LoadUsers can report.
  const [usersStatus, setUsersStatus] = useState(() => bridge?.usersStatus ?? -1)

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
    // Already coerced by code.js. The fallbacks are for the malformed dispatch
    // that should never arrive, and they fall the safe way: no name, no role.
    bridge.onUsername = (value) => {
      setUsername(typeof value === 'string' ? value : '')
    }
    bridge.onRole = (value) => {
      setRole(Number.isInteger(value) && value >= 0 ? value : 0)
    }
    bridge.onChangePasswordMessage = ({ code, duration }) => {
      setPasswordMessage((previous) => ({
        code, duration, seq: (previous?.seq ?? 0) + 1,
      }))
    }
    bridge.onAddUserMessage = ({ code, duration }) => {
      setAddUserMessage((previous) => ({
        code, duration, seq: (previous?.seq ?? 0) + 1,
      }))
    }
    // Validated by the LoadUsers method, so rows are stored as-is. A failure
    // carries no rows and leaves whatever is on screen alone: a refresh that
    // breaks should not blank a list that was working.
    bridge.onUsers = ({ status, rows }) => {
      setUsersStatus(status)
      if (status === 0) setUsers(Array.isArray(rows) ? rows : [])
    }

    // Anything dispatched before React mounted, replayed now that the
    // handlers exist.
    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onUsername = null
      bridge.onRole = null
      bridge.onChangePasswordMessage = null
      bridge.onAddUserMessage = null
      bridge.onUsers = null
      bridge.onConnected = null
    }
  }, [bridge])

  return {
    ready,
    language,
    username,
    role,
    passwordMessage, setPasswordMessage,
    addUserMessage, setAddUserMessage,
    users, usersStatus, setUsersStatus,
    // Bound so callers need no reference to the bridge itself. Standalone is
    // detected inside fire(), which logs rather than throwing.
    fire: (name, payload) => bridge?.fire(name, payload),
  }
}
