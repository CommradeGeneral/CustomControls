import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { RecipeComponents } from './RecipeComponents'
import { RecipeCreated } from './RecipeCreated'
import { formatDate, toActive, toComponent, toText } from '../../lib/containerValues'
import { useRecipeEdit } from '../../hooks/useRecipeEdit'
import './RecipeDetail.css'

// Same shape as the other panes' label tables, so every half of the control is
// translated the same way rather than one hardcoding English.
const labels = {
  en: {
    components: 'Recipe Components',
    index: '#', material: 'Material', materialCode: 'Material Code',
    quantity: 'Target Quantity', unit: 'Unit',
    code: 'Recipe Code', created: 'Created On', updated: 'Last Modified',
    active: 'Active', inactive: 'Inactive',
    summary: 'Recipe Summary', description: 'Description',
    totalMaterials: 'Total Materials', totalQuantity: 'Total Quantity',
    noComponents: 'This recipe has no components.',
    noDescription: 'No description',
    edit: 'Edit', save: 'Save', discard: 'Discard',
    saving: 'Saving…',
    saveFailed: 'The changes could not be saved.',
    incompleteRows: 'Every component row needs a material and a quantity.',
    duplicateRows: 'Each material can only appear once.',
    noRows: 'Add at least one component.',
    delete: 'Delete', confirmDelete: 'Confirm delete?', cancel: 'Cancel',
    deleting: 'Deleting…',
    deleteFailed: 'The recipe could not be deleted.',
  },
  ar: {
    components: 'مكونات الوصفة',
    index: '#', material: 'المادة', materialCode: 'رمز المادة',
    quantity: 'الكمية المستهدفة', unit: 'الوحدة',
    code: 'رمز الوصفة', created: 'أُنشئت', updated: 'آخر تحديث',
    active: 'نشطة', inactive: 'غير نشطة',
    summary: 'ملخص الوصفة', description: 'الوصف',
    totalMaterials: 'إجمالي المواد', totalQuantity: 'إجمالي الكمية',
    noComponents: 'لا توجد مكونات لهذه الوصفة.',
    noDescription: 'لا يوجد وصف',
    edit: 'تعديل', save: 'حفظ', discard: 'تجاهل',
    saving: 'جارٍ الحفظ…',
    saveFailed: 'تعذّر حفظ التغييرات.',
    incompleteRows: 'كل صف مكوّن يحتاج إلى مادة وكمية.',
    duplicateRows: 'لا يمكن تكرار المادة أكثر من مرة.',
    noRows: 'أضف مكوّنًا واحدًا على الأقل.',
    delete: 'حذف', confirmDelete: 'تأكيد الحذف؟', cancel: 'إلغاء',
    deleting: 'جارٍ الحذف…',
    deleteFailed: 'تعذّر حذف الوصفة.',
  },
}


/**
 * Detail page for one recipe.
 *
 * Shows only what the schema holds. The mock-up this follows also carried
 * client, batch size, version, created-by, per-component source, tolerance and
 * notes - none of which exist as columns, so they are omitted rather than
 * rendered blank or invented.
 */
export function RecipeDetail({ recipe, language = 'en', deleteMessage = null, saveMessage = null, materials = null, onDelete, onSave, onSidePage }) {
  const text = labels[language] ?? labels.en
  const rtl = language === 'ar'

  // 'idle' -> 'confirming' -> 'pending'. Deleting is irreversible and cascades
  // to the component rows, so a single click must not do it: the confirm step
  // is a deliberate second action rather than a dialog, which keeps the whole
  // interaction inside the pane.
  const [phase, setPhase] = useState('idle')
  const [failed, setFailed] = useState(false)

  // Reset when a different recipe is shown: a confirm left open against the
  // previous one must not carry over to this.
  const recipeId = recipe?.id ?? recipe?.Id ?? null
  useEffect(() => {
    setPhase('idle')
    setFailed(false)
  }, [recipeId])

  // The container's verdict. 0 closes the page, which the parent handles, so
  // only the failure and the withdrawal are dealt with here. Keyed on seq so
  // re-sending the same code is not ignored as equal state.
  useEffect(() => {
    if (!deleteMessage) return undefined
    if (deleteMessage.code === 1) {
      setPhase('idle')
      setFailed(true)
      if (!(deleteMessage.duration > 0)) return undefined
      const timer = setTimeout(() => setFailed(false), deleteMessage.duration)
      return () => clearTimeout(timer)
    }
    // Anything but a failure clears the pending state without a message.
    setPhase('idle')
    setFailed(false)
    return undefined
  }, [deleteMessage?.seq, deleteMessage?.code, deleteMessage?.duration])

  const pick = (...keys) => {
    for (const key of keys) {
      if (recipe[key] !== undefined && recipe[key] !== null) return recipe[key]
    }
    return undefined
  }

  const code = toText(pick('code', 'Code'))
  const name = toText(pick('name', 'Name'))
  // A NULL column does not always arrive as null: serializing the row can turn
  // it into the string "null" or "undefined", which are truthy and would
  // otherwise be printed literally where the placeholder belongs. Trimmed too,
  // so a column holding only spaces counts as empty.
  const description = toText(pick('description', 'Description'))
  const isActive = toActive(pick('is_active', 'isActive', 'Active'))
  const created = formatDate(pick('created_at', 'createdAt', 'Created'))
  const updated = formatDate(pick('updated_at', 'updatedAt', 'Updated'))

  const rawComponents = Array.isArray(recipe.components) ? recipe.components : []
  const components = rawComponents.map(toComponent)

  // Editing toggles in place rather than opening a form: only the description,
  // the active flag and the component rows can change, so the page keeps its
  // shape and the operator stays where they were reading. The phases and the
  // draft live in the hook; what remains here is rendering them.
  const edit = useRecipeEdit({
    recipeId, description, isActive, components, code, name, saveMessage, onSave,
  })
  const { draft, setDraft, rows, isEditing, canSave, hasPartialRow, hasDuplicateRow } = edit

  // The success page is internal to this component, so the parent cannot see
  // it to name the side page. Cleared on unmount, so leaving the detail does
  // not leave 'saved' standing as the current pane.
  const showingSaved = edit.phase === 'saved'
  useEffect(() => {
    onSidePage?.(showingSaved ? 'saved' : null)
    return () => onSidePage?.(null)
  }, [showingSaved])

  // Summed from the draft while editing and from the saved row otherwise, so
  // the figure always describes what the table above it is showing.
  //
  // Blank and non-numeric entries contribute nothing rather than poisoning the
  // sum with NaN, and the result is rounded because adding decimals gives
  // values like 2349.9999999999995, which reads as noise.
  const totalQuantity = Math.round((isEditing
    ? rows.reduce((sum, row) => {
        const value = Number(row.quantity)
        return Number.isFinite(value) ? sum + value : sum
      }, 0)
    : components.reduce(
        (sum, row) => (Number.isFinite(row.quantity) ? sum + row.quantity : sum), 0)
  ) * 1000) / 1000

  return (
    <div className="recipe-detail" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Takes over the pane rather than reporting into a line, the same way a
          create does: the row has changed, so the fields describing it as it
          was are the wrong thing to leave on screen. The pane's own close
          button stays, so a success sent without a timeout is dismissible. */}
      {edit.phase === 'saved' ? (
        <RecipeCreated language={language} variant="saved" />
      ) : (
      <div className="recipe-detail__scroll">
        <header className="recipe-detail__header">
          <h2 className="recipe-detail__title">{name || code}</h2>
          {/* The same pill, made clickable: the flag is changed where it is
              read rather than in a panel elsewhere on the page, and it keeps
              the green/red the card list uses so the state stays recognisable
              while it is being edited.

              The checkbox itself is still there, only visually hidden - it is
              what makes this operable by keyboard and reported correctly to a
              screen reader, which a styled span alone would not be. */}
          {isEditing ? (
            <label className={'recipe-detail__status recipe-detail__status--editable' +
              (draft.is_active ? '' : ' recipe-detail__status--inactive')}>
              <input
                className="recipe-detail__status-input"
                type="checkbox"
                checked={draft.is_active}
                disabled={edit.phase === 'saving'}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, is_active: event.target.checked }))}
              />
              <span>{draft.is_active ? text.active : text.inactive}</span>
            </label>
          ) : (
            <span className={'recipe-detail__status' +
              (isActive ? '' : ' recipe-detail__status--inactive')}>
              {isActive ? text.active : text.inactive}
            </span>
          )}

          {/* Pushed to the far end by margin rather than a spacer element, so
              it follows the row's direction without extra markup. */}
          <div className="recipe-detail__actions">
            {/* Delete is hidden while editing: the two are different kinds of
                destructive, and offering both at once invites the wrong one. */}
            {phase === 'idle' && edit.phase === 'idle' && (
              <>
                <button
                  className="recipe-detail__button"
                  type="button"
                  onClick={edit.startEditing}
                >
                  <Pencil size="1em" aria-hidden="true" /> {text.edit}
                </button>
                <button
                  className="recipe-detail__button recipe-detail__button--danger"
                  type="button"
                  onClick={() => setPhase('confirming')}
                >
                  <Trash2 size="1em" aria-hidden="true" /> {text.delete}
                </button>
              </>
            )}

            {/* Save and Discard live in the footer, where the create form puts
                its own actions, rather than up here beside the title. */}

            {phase === 'confirming' && (
              <>
                <button
                  className="recipe-detail__button recipe-detail__button--danger"
                  type="button"
                  onClick={() => {
                    // The control deletes nothing: it reports the intent and
                    // waits for DeleteRecipeMessage. Pending until then, so a
                    // second confirm cannot be sent while the first is being
                    // written.
                    setPhase('pending')
                    setFailed(false)
                    onDelete?.(recipeId)
                  }}
                >
                  {text.confirmDelete}
                </button>
                <button
                  className="recipe-detail__button"
                  type="button"
                  onClick={() => setPhase('idle')}
                >
                  {text.cancel}
                </button>
              </>
            )}

            {phase === 'pending' && (
              <span className="recipe-detail__pending">{text.deleting}</span>
            )}
          </div>
        </header>

        {/* One reserved line, so a failure does not shift the panel below it.
            Announced rather than only shown, since the button it belongs to
            has already returned to its resting state by the time it appears. */}
        {failed && (
          <p className="recipe-detail__error recipe-detail__error--boxed" role="alert">
            {text.deleteFailed}
          </p>
        )}


        <dl className="recipe-detail__meta">
          {/* Codes and dates are ASCII: the bdi keeps their characters in
              order while the item stays aligned with its label. */}
          <div className="recipe-detail__meta-item">
            <dt>{text.code}</dt>
            <dd><bdi className="recipe-detail__ltr" dir="ltr">{code || '—'}</bdi></dd>
          </div>
          <div className="recipe-detail__meta-item">
            <dt>{text.created}</dt>
            <dd><bdi className="recipe-detail__ltr" dir="ltr">{created || '—'}</bdi></dd>
          </div>
          <div className="recipe-detail__meta-item">
            <dt>{text.updated}</dt>
            <dd><bdi className="recipe-detail__ltr" dir="ltr">{updated || '—'}</bdi></dd>
          </div>
        </dl>

        <section className="recipe-detail__section">
          {/* RecipeComponents carries its own heading, so this one is dropped
              while editing rather than printed twice. */}
          {!isEditing && (
            <h3 className="recipe-detail__section-title">{text.components}</h3>
          )}
          {/* Framed like the create form's table, so the rows sit on their own
              white surface rather than directly on the pane. */}
          {isEditing ? (
            /* The create form's own component table, so the material
               dropdowns, the add and remove controls and the row rules are
               the ones already in use rather than a second implementation. */
            <RecipeComponents
              language={language}
              materials={materials}
              rows={draft.components}
              onChange={(next) =>
                setDraft((current) => ({ ...current, components: next }))}
            />
          ) : (
          <div className="recipe-detail__table-frame">
            <table className="recipe-detail__table">
            <thead>
              <tr>
                <th className="recipe-detail__col-index" scope="col">{text.index}</th>
                <th className="recipe-detail__col-material" scope="col">{text.material}</th>
                <th className="recipe-detail__col-code" scope="col">{text.materialCode}</th>
                <th className="recipe-detail__col-qty" scope="col">{text.quantity}</th>
                <th className="recipe-detail__col-unit" scope="col">{text.unit}</th>
              </tr>
            </thead>
            <tbody>
              {components.length === 0 && (
                <tr>
                  <td className="recipe-detail__empty" colSpan={5}>{text.noComponents}</td>
                </tr>
              )}
              {components.map((row, index) => (
                <tr key={row.key}>
                  <td className="recipe-detail__col-index">{index + 1}</td>
                  {/* The cell decides where the value sits, following the
                      row's direction; the bdi inside decides only how its
                      characters are ordered. dir on the cell itself would do
                      both, which is what pulled these to the wrong edge. */}
                  <td className="recipe-detail__col-material">
                    {row.name || row.code}
                  </td>
                  <td className="recipe-detail__col-code">
                    <bdi className="recipe-detail__ltr" dir="ltr">{row.code || '—'}</bdi>
                  </td>
                  <td className="recipe-detail__col-qty">
                    <bdi className="recipe-detail__ltr" dir="ltr">
                      {row.quantity === null ? '—' : row.quantity}
                    </bdi>
                  </td>
                  <td className="recipe-detail__col-unit">
                    <bdi className="recipe-detail__ltr" dir="ltr">{row.unit || '—'}</bdi>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          )}
        </section>

        <div className="recipe-detail__panels">
          <section className="recipe-detail__section recipe-detail__section--panel">
            <h3 className="recipe-detail__section-title">{text.summary}</h3>
            <dl className="recipe-detail__summary">
              <div className="recipe-detail__summary-row">
                <dt>{text.totalMaterials}</dt>
                {/* Counts the draft while editing, so the summary agrees with
                    the table above it rather than reporting the saved row. A
                    row with no material chosen is not a material yet. */}
                <dd>
                  <bdi className="recipe-detail__ltr" dir="ltr">
                    {isEditing
                      ? rows.filter((row) => row.material_code !== '').length
                      : components.length}
                  </bdi>
                </dd>
              </div>
              <div className="recipe-detail__summary-row">
                <dt>{text.totalQuantity}</dt>
                {/* Follows the draft while editing for the same reason the
                    count does: the summary has to agree with the table above
                    it rather than report the row as it was last saved. */}
                <dd>
                  <bdi className="recipe-detail__ltr" dir="ltr">{totalQuantity}</bdi>
                </dd>
              </div>
            </dl>
          </section>

          <section className="recipe-detail__section recipe-detail__section--panel">
            <h3 className="recipe-detail__section-title">{text.description}</h3>
            {isEditing ? (
              <textarea
                className="recipe-detail__description-input"
                value={draft.description}
                disabled={edit.phase === 'saving'}
                placeholder={text.noDescription}
                rows={3}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))}
              />
            ) : (
              /* Classed as a placeholder when there is nothing to show, so an
                 absent description reads as absence rather than as text the
                 operator might mistake for the recipe's own. */
              <p className={'recipe-detail__description' +
                (description ? '' : ' recipe-detail__description--empty')}>
                {description || text.noDescription}
              </p>
            )}
          </section>
        </div>
      </div>
      )}

      {/* Outside the scrolling body, so the actions stay reachable however far
          down the page the operator has scrolled - the same arrangement the
          create form uses for its own step buttons. */}
      {isEditing && (
        <div className="recipe-detail__footer">
          {/* One reserved line carrying whichever message applies, so neither a
              blocked save nor a failed one shifts the buttons beside it. */}
          <p className="recipe-detail__error" role="alert">
            {edit.failed
              ? text.saveFailed
              : canSave
                ? ''
                : hasPartialRow
                  ? text.incompleteRows
                  : hasDuplicateRow ? text.duplicateRows : text.noRows}
          </p>

          <div className="recipe-detail__footer-actions">
            {/* Saving replaces Save, so it cannot be sent twice - but Discard
                stays, because the pane leaves this state only when the
                container answers through NewRecipeMessage. A container that
                never answers would otherwise strand the operator here with no
                way back to the page. */}
            {edit.phase === 'saving' && (
              <span className="recipe-detail__pending">{text.saving}</span>
            )}
            {(
              <>
                <button
                  className="recipe-detail__button"
                  type="button"
                  onClick={edit.discard}
                >
                  {text.discard}
                </button>
                {edit.phase !== 'saving' && (
                  <button
                    className="recipe-detail__button recipe-detail__button--primary"
                    type="button"
                    onClick={edit.save}
                    disabled={!canSave}
                  >
                    {text.save}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
