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
 * Returned as state plus the setters the UI needs, because several of these
 * are written from both directions - a card click clears `recipePage` as
 * readily as CreateRecipePage sets it.
 *
 * `fire` is passed through rather than the bridge itself, so a caller cannot
 * reach past this into the container's plumbing.
 */
export function useBridge() {
  const bridge = window.RecipeBridge

  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(
    () => !bridge?.hasContainer || bridge?.connected === true)

  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const seeded = Number(bridge?.recipeItemsPerPage)
    return Number.isInteger(seeded) && seeded >= 1 ? seeded : 5
  })
  // Null until the container calls CreateCards; see the bridge field for why
  // that is kept distinct from an empty array.
  const [recipes, setRecipes] = useState(() => bridge?.recipes ?? null)
  // Null until the container calls LoadAvailableMaterials; the component
  // dropdowns are empty until it does.
  const [materials, setMaterials] = useState(() => bridge?.materials ?? null)
  // The recipe the detail page is showing, supplied through CreateRecipePage.
  // Null means no page is open; the pane then falls back to the selected row's
  // placeholder or the empty state.
  const [recipePage, setRecipePage] = useState(() => bridge?.recipePage ?? null)
  // Bumped on every CreateRecipePage call, and used as the detail page's key
  // so each call mounts a fresh one. The page holds edit, delete-confirm and
  // success state of its own, none of which the container can see; without
  // this, calling the method again would replace the data while leaving that
  // state on top of it, so a page mid-edit would ignore the new payload.
  const [recipePageSession, setRecipePageSession] = useState(0)
  // What the card list shows in place of its rows, raised by
  // LoadingCardsMessage: 1 loading, 2 failed, 0 neither. Cleared when
  // CreateCards delivers rows.
  const [loadingCards, setLoadingCards] = useState(
    () => Number(bridge?.loadingCards) || 0)
  // Outcome of a create attempt, raised by NewRecipeMessage. `seq` makes every
  // call distinct, so re-sending the same code restarts the countdown rather
  // than being ignored as equal state.
  //
  // Volatile by design: never written to a property or to storage, so a
  // recreated control comes up with no message.
  const [newRecipeMessage, setNewRecipeMessage] = useState(null)
  // Outcome of a delete, raised by DeleteRecipeMessage. Same seq contract.
  const [deleteMessage, setDeleteMessage] = useState(null)
  // Outcome of an inline edit saved from the detail page. Carried on the same
  // NewRecipeMessage codes as a create, since a container reporting 0 or 1 is
  // saying the same two things.
  const [saveMessage, setSaveMessage] = useState(null)
  // Set by ClearSidePage and by a delete, both of which drop whatever the pane
  // was showing. Read by App, which owns the pane's own flags.
  const [clearPaneSignal, setClearPaneSignal] = useState(0)

  useEffect(() => {
    if (!bridge) return undefined

    // The handshake mutates plain fields, which React cannot observe; this is
    // the notification that lets the gate re-evaluate once it settles.
    bridge.onConnected = () => {
      setReady(!bridge.hasContainer || bridge.connected === true)
    }
    bridge.onLanguage = (value) => {
      const next = typeof value === 'string' && value.toLowerCase() === 'ar' ? 'ar' : 'en'
      setLanguage(next)
    }
    bridge.onRecipeItemsPerPage = (value) => {
      const next = Number(value)
      if (Number.isInteger(next) && next >= 1) setItemsPerPage(next)
    }
    // Delivered by the CreateCards method, which has already validated that
    // this is an array, so it is stored as-is and normalized at render.
    bridge.onRecipes = (value) => {
      setRecipes(Array.isArray(value) ? value : null)
    }
    // Validated by LoadAvailableMaterials the same way rows are.
    bridge.onMaterials = (value) => {
      setMaterials(Array.isArray(value) ? value : null)
    }
    bridge.onLoadingCards = (value) => {
      setLoadingCards(Number(value) || 0)
    }
    // Validated by the CreateRecipePage method, so this is stored as-is.
    bridge.onRecipePage = (value) => {
      setRecipePage(value)
      // A new session even for the same recipe: the call is the container
      // saying what the pane should show, which outranks whatever the operator
      // had open - an unsaved edit, a delete confirm, or a success page.
      setRecipePageSession((session) => session + 1)
      // The outcome of an earlier save belongs to the page that asked for it.
      // Left standing, it re-applies the moment the next page renders and the
      // success pane reappears over a recipe nobody just saved - the message
      // is a prop, so the page cannot clear it from the inside.
      setSaveMessage(null)
    }
    bridge.onDeleteRecipeMessage = ({ code, duration }) => {
      setDeleteMessage((previous) => ({
        code, duration, seq: (previous?.seq ?? 0) + 1,
      }))
      // A deleted recipe cannot still be on screen, so the pane is dropped and
      // the card selection with it - the list is about to be re-sent without
      // that row, and a selection pointing at it would be stale.
      if (code === 0) {
        setRecipePage(null)
        setSaveMessage(null)
        setClearPaneSignal((signal) => signal + 1)
      }
    }
    bridge.onNewRecipeMessage = ({ code, duration }) => {
      const next = (previous) => ({
        code, duration, seq: (previous?.seq ?? 0) + 1,
      })
      // The same method reports both, because the container answers a create
      // and a save the same way. Whichever pane is open is the one that asked.
      setNewRecipeMessage(next)
      setSaveMessage(next)
    }
    // Drops whichever pane is showing. App clears its own flags from the
    // signal, since the form and the selection live there.
    bridge.onClearSidePage = () => {
      setNewRecipeMessage(null)
      setSaveMessage(null)
      setRecipePage(null)
      setClearPaneSignal((signal) => signal + 1)
    }

    // Anything dispatched before React mounted, replayed now that the
    // handlers exist.
    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onRecipeItemsPerPage = null
      bridge.onRecipes = null
      bridge.onMaterials = null
      bridge.onRecipePage = null
      bridge.onLoadingCards = null
      bridge.onNewRecipeMessage = null
      bridge.onDeleteRecipeMessage = null
      bridge.onClearSidePage = null
      bridge.onConnected = null
    }
  }, [bridge])

  return {
    ready,
    language,
    itemsPerPage, setItemsPerPage,
    recipes,
    materials,
    recipePage, setRecipePage,
    recipePageSession,
    loadingCards, setLoadingCards,
    newRecipeMessage, setNewRecipeMessage,
    deleteMessage,
    saveMessage, setSaveMessage,
    clearPaneSignal,
    // Bound so callers need no reference to the bridge itself. Standalone is
    // detected inside fire(), which logs rather than throwing.
    fire: (name, payload) => bridge?.fire(name, payload),
  }
}
