import { useEffect, useState } from 'react'

/**
 * Who owns the main pane, and what has to be cleared when that changes.
 *
 * Three things compete for it - the detail page, the form, and the selected
 * row's loading placeholder - and every transition between them has to clear
 * the others. Scattering those clears across the handlers that triggered them
 * is what lets a form open behind a detail page, or a stale success pane
 * reappear over an unrelated row.
 *
 * Gathered here so each transition is one named function that states the whole
 * consequence, rather than six setters at a call site.
 *
 * `itemPage` and the message state live in useBridge, since the container
 * writes them; this takes the setters it needs to clear them.
 */
export function useMainPane({
  clearPaneSignal,
  setItemPage,
  setCreateMessage,
  setSaveMessage,
  fire,
}) {
  // The row the list has selected, or null. Held here rather than in ItemList
  // because the pane beside the list needs it too, and the list is the only
  // thing that can report it.
  const [selectedRow, setSelectedRow] = useState(null)
  // True while the form holds the pane.
  const [creating, setCreating] = useState(false)
  // Bumped every time the form is opened, and used as its key so React mounts
  // a fresh one rather than reusing the last. The form holds state seeded only
  // at mount - the draft, the error flag and the container's outcome - and
  // reusing the instance would carry all of it over, so a create that just
  // succeeded would reopen on its success page.
  const [createSession, setCreateSession] = useState(0)
  // The success panes, which live inside the form and the detail page and so
  // cannot be derived from the state here. Null while neither is showing.
  const [sidePageOverride, setSidePageOverride] = useState(null)

  // ClearSidePage and a completed delete both drop the pane from the
  // container's side. The bridge clears what it owns; these are the flags it
  // cannot reach.
  useEffect(() => {
    if (clearPaneSignal === 0) return
    setCreating(false)
    setSelectedRow((previous) => {
      // The container is told only if there was something to clear, so an
      // already-empty pane does not fire a redundant deselect.
      if (previous) fire('onItemSelect', '')
      return null
    })
  }, [clearPaneSignal])

  /** The operator picked a row: the pane waits for its detail. */
  const selectRow = (row) => {
    setSelectedRow(row)
    // A different row is a different record: an earlier save's outcome must
    // not be reported against it.
    setSaveMessage(null)
    // A row click abandons an open form, discarding its draft.
    setCreating(false)
    // And it drops the detail page, which describes the row that was open
    // before this one. Without this the pane keeps showing the previous record
    // until CreateItemPage answers, so the wait is invisible and the operator
    // reads stale detail as if it were the row they just picked.
    setItemPage(null)
  }

  /** The operator pressed New: the form takes the pane. */
  const startCreating = () => {
    // Purely outbound: the control opens the form itself, so this only tells
    // the container the operator started one - its cue to send whatever the
    // form's fields are chosen from.
    fire('onNewItemButton')
    setCreating(true)
    // A new session, so the form starts with empty fields however the last
    // one ended.
    setCreateSession((session) => session + 1)
    // The previous outcome goes too: it is what the form renders the success
    // page from, and a live one would reopen straight onto it. Clearing the
    // state is what matters - the key alone would not help, since the message
    // is passed in as a prop.
    setCreateMessage(null)
    // A save's outcome belongs to the detail page, not to the form now taking
    // the pane.
    setSaveMessage(null)
    // The form takes the pane, so an open detail page goes with it - otherwise
    // the pane keeps rendering that row and the form never appears.
    setItemPage(null)
    // Clearing the row also unhighlights it in the list, since the list
    // follows selectedId - and TIA is told, so the container does not keep a
    // selection the control no longer shows.
    setSelectedRow((previous) => {
      if (previous) fire('onItemSelect', '')
      return null
    })
  }

  /** The form was cancelled or closed. */
  const cancelCreating = () => {
    setCreating(false)
    setCreateMessage(null)
  }

  /** The detail pane was dismissed: both halves of the selection go. */
  const deselect = () => {
    setSelectedRow(null)
    setItemPage(null)
    setSaveMessage(null)
    fire('onItemSelect', '')
  }

  return {
    selectedRow, creating, createSession,
    sidePageOverride, setSidePageOverride,
    selectRow, startCreating, cancelCreating, deselect,
  }
}
