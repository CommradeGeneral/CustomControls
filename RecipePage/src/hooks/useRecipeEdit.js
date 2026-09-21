import { useEffect, useState } from 'react'
import { emptyComponent } from '../components/MainPageElements/RecipeComponents'

/**
 * Editing a recipe in place on its detail page.
 *
 * Four phases, and the transitions between them are the whole feature:
 *
 *   idle     the page is read-only
 *   editing  a draft exists and the fields are live
 *   saving   the draft has gone to the container, which has not answered
 *   saved    it answered yes, and the success pane has the page
 *
 * The draft is held separately from the recipe prop, so discarding is simply
 * dropping it - there is nothing to undo, and the page falls back to what the
 * container last sent.
 *
 * Validation mirrors the create form's component step, so a recipe cannot be
 * edited into a state that form would have refused to create.
 */
export function useRecipeEdit({ recipeId, description, isActive, components, code, name, saveMessage, onSave }) {
  const [phase, setPhase] = useState('idle')
  const [draft, setDraft] = useState(null)
  const [failed, setFailed] = useState(false)

  // A different recipe is a different page: an edit left open against the
  // previous one must not carry its draft over to this.
  useEffect(() => {
    setPhase('idle')
    setDraft(null)
    setFailed(false)
  }, [recipeId])

  // The container's verdict. 0 takes over the pane with the success page, the
  // way a create does; 1 returns to editing with the draft intact, so the
  // operator can correct it rather than retype it.
  useEffect(() => {
    if (!saveMessage) return undefined

    if (saveMessage.code === 1) {
      setPhase('editing')
      setFailed(true)
      if (!(saveMessage.duration > 0)) return undefined
      const timer = setTimeout(() => setFailed(false), saveMessage.duration)
      return () => clearTimeout(timer)
    }

    if (saveMessage.code === 0) {
      setPhase('saved')
      setFailed(false)
      // Zero or less leaves the page up until the operator closes it, the same
      // convention the create form follows. Otherwise it returns to the recipe
      // once the timeout expires - the draft is dropped either way, since the
      // row now matches what was sent.
      if (!(saveMessage.duration > 0)) return undefined
      const timer = setTimeout(() => {
        setPhase('idle')
        setDraft(null)
      }, saveMessage.duration)
      return () => clearTimeout(timer)
    }

    // Any other code withdraws the message without reporting anything.
    setPhase('idle')
    setDraft(null)
    setFailed(false)
    return undefined
  }, [saveMessage?.seq, saveMessage?.code, saveMessage?.duration])

  // 'saved' is deliberately excluded: that phase has replaced the whole pane
  // with the success page, so the editable fields behind it are not rendered.
  const isEditing = phase === 'editing' || phase === 'saving'

  /*
   * Seed the draft from the recipe on screen.
   *
   * Built when Edit is pressed rather than held alongside the recipe, so the
   * page shows the container's data until the operator chooses to change it.
   *
   * Quantities become strings because the row inputs are text: a number would
   * make "12." unrepresentable while it is being typed.
   */
  const startEditing = () => {
    setDraft({
      description,
      is_active: isActive,
      components: components.length === 0
        ? [emptyComponent()]
        : components.map((row, index) => ({
            key: `d${index}-${Math.random().toString(36).slice(2, 8)}`,
            material_code: row.code,
            quantity: row.quantity === null ? '' : String(row.quantity),
          })),
    })
    setFailed(false)
    setPhase('editing')
  }

  const discard = () => {
    setDraft(null)
    setPhase('idle')
    setFailed(false)
  }

  const rows = draft?.components ?? []
  const rowComplete = (row) =>
    row.material_code !== '' && String(row.quantity).trim() !== ''
  // The row the step opens with is a placeholder, not an unfinished row, so it
  // is reported as "add a component" rather than as incomplete.
  const isOpeningRow = rows.length === 1 && rows[0].material_code === '' &&
    String(rows[0].quantity).trim() === ''
  const hasPartialRow = !isOpeningRow && rows.some((row) => !rowComplete(row))
  const chosenCodes = rows.map((row) => row.material_code).filter((c) => c !== '')
  const hasDuplicateRow = new Set(chosenCodes).size !== chosenCodes.length
  const canSave = rows.length > 0 && !isOpeningRow && !hasPartialRow && !hasDuplicateRow

  const save = () => {
    if (!canSave) return
    setPhase('saving')
    setFailed(false)
    onSave?.({
      id: recipeId,
      // Sent unchanged so the container can address the row, though neither
      // can be edited here.
      code,
      name,
      description: draft.description.trim(),
      is_active: draft.is_active,
      // The local row key is dropped: it exists only so React can track rows
      // while editing and would be meaningless to the container.
      components: rows
        .filter((row) => row.material_code !== '')
        .map(({ key, ...row }) => ({
          ...row,
          quantity: row.quantity === '' ? null : Number(row.quantity),
        })),
    })
  }

  return {
    phase, isEditing, draft, setDraft, failed, rows,
    canSave, hasPartialRow, hasDuplicateRow,
    startEditing, discard, save,
  }
}
