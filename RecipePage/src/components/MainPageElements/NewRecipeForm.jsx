import { useEffect, useState } from 'react'
import { CloseButton } from './CloseButton'
import { RecipeComponents, emptyComponent } from './RecipeComponents'
import { RecipeCreated } from './RecipeCreated'
import './NewRecipeForm.css'

/**
 * Outcomes the container can raise through the NewRecipeMessage method.
 * Any other number shows nothing, which is how a message is withdrawn.
 */
const OUTCOMES = {
  0: {
    ok: true,
    // Replaces the form with a success pane rather than writing into its
    // message line: the draft has become a row, so a filled-in form describing
    // something still pending is the wrong thing to leave on screen.
    page: true,
    en: 'Recipe created.',
    ar: 'تم إنشاء الوصفة.',
  },
  1: {
    ok: false,
    en: 'Error adding the recipe to the database.',
    ar: 'تعذّر إضافة الوصفة إلى قاعدة البيانات.',
  },
}

// Same shape as the other panes' tables, so every half of the control is
// translated the same way rather than one hardcoding English.
const labels = {
  en: {
    heading: 'New Recipe',
    code: 'Code', name: 'Name', description: 'Description',
    active: 'Active', inactive: 'Inactive',
    requiredMark: 'required',
    codePlaceholder: 'RC-0000',
    namePlaceholder: 'Recipe name',
    descriptionPlaceholder: 'What this recipe produces',
    save: 'Create recipe', cancel: 'Cancel', next: 'Next', back: 'Back',
    required: 'Code and name are required.',
    duplicateCode: 'Duplicated code.',
    incompleteRows: 'Every component row needs a material and a quantity.',
    noRows: 'Add at least one component.',
    duplicateRows: 'Each material can only appear once.',
    stepDetails: 'Details', stepComponents: 'Components',
    stepOf: 'Step {current} of {total}',
  },
  ar: {
    heading: 'وصفة جديدة',
    code: 'الرمز', name: 'الاسم', description: 'الوصف',
    active: 'نشطة', inactive: 'غير نشطة',
    requiredMark: 'مطلوب',
    codePlaceholder: 'RC-0000',
    namePlaceholder: 'اسم الوصفة',
    descriptionPlaceholder: 'ما تنتجه هذه الوصفة',
    save: 'إنشاء الوصفة', cancel: 'إلغاء', next: 'التالي', back: 'رجوع',
    required: 'الرمز والاسم مطلوبان.',
    duplicateCode: 'الرمز مكرَّر.',
    incompleteRows: 'كل صف مكوّن يحتاج إلى مادة وكمية.',
    noRows: 'أضف مكوّنًا واحدًا على الأقل.',
    duplicateRows: 'لا يمكن تكرار المادة أكثر من مرة.',
    stepDetails: 'التفاصيل', stepComponents: 'المكونات',
    stepOf: 'الخطوة {current} من {total}',
  },
}

// Mirrors the columns the cards render. id and the timestamps are assigned by
// the database, so they are deliberately absent: an operator typing a primary
// key is a data-integrity problem, not a feature.
const emptyDraft = {
  code: '',
  name: '',
  description: '',
  is_active: true,
}

const TOTAL_STEPS = 2

/**
 * Create-recipe form for the main pane.
 *
 * Two steps: the recipe's own columns, then its component rows. Both drafts
 * live here for the whole flow, so stepping back and forward again does not
 * discard anything - only cancelling does.
 *
 * Holds the draft locally and hands the finished record to onSubmit; it does
 * not write anywhere itself, since the container owns persistence the same way
 * it owns the row list. Validation is deliberately minimal - code and name
 * only - because the authoritative constraints live in the database and
 * duplicating them here would drift.
 */
export function NewRecipeForm({ language = 'en', message = null, materials = null, existingCodes = [], onSidePage, onSubmit, onCancel }) {
  const text = labels[language] ?? labels.en
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState(emptyDraft)
  // Starts with one blank row: an empty table with only an Add button reads as
  // broken, where a single row shows what the step is for.
  const [components, setComponents] = useState(() => [emptyComponent()])
  const [showError, setShowError] = useState(false)
  // Set once the draft has been handed off. The form stays open afterwards, so
  // without this the button would fire and change nothing an operator can see.
  // Which container-raised outcome is on screen. Held separately from the
  // `message` prop so it can be cleared by its own timeout, and so an
  // unrecognised code simply shows nothing.
  const [outcome, setOutcome] = useState(null)

  // Keyed on `seq`, so re-sending the same code restarts the countdown rather
  // than leaving the original timer to expire early. The timer is cleared on
  // cleanup: without that a superseded timeout would hide a newer message.
  useEffect(() => {
    if (!message || !OUTCOMES[message.code]) {
      setOutcome(null)
      return undefined
    }
    setOutcome(message.code)
    // Zero or less means it stays until the form is closed or edited. A
    // success pane with no timeout therefore waits on its close button rather
    // than stranding the operator.
    if (!(message.duration > 0)) return undefined
    // An outcome that took over the pane exits the form when it expires;
    // one that only wrote into the message line just clears it.
    const expire = OUTCOMES[message.code].page
      ? () => onCancel?.()
      : () => setOutcome(null)
    const timer = setTimeout(expire, message.duration)
    return () => clearTimeout(timer)
  }, [message?.seq, message?.code, message?.duration])

  // Compared case-insensitively: RC-0001 and rc-0001 are the same code to a
  // reader, and the database's collation is very likely to agree, so accepting
  // one because it differs in case would only defer the clash to the insert.
  //
  // An empty field is not a duplicate - it is the "required" case, which the
  // check below reports instead.
  const trimmedCode = draft.code.trim()
  const isDuplicateCode = trimmedCode !== '' && existingCodes.some(
    (code) => String(code).trim().toLowerCase() === trimmedCode.toLowerCase()
  )
  const isValid = trimmedCode !== '' && draft.name.trim() !== '' && !isDuplicateCode

  // Every row on the table has to carry both fields: one the operator added
  // and left blank is an unfinished row, not a placeholder to be discarded.
  //
  // The single exception is the untouched row the step opens with. It is there
  // to show what the step is for, so blocking on it would make the form arrive
  // dead with nothing to explain it - and that state is reported as "add a
  // component" rather than as an incomplete row.
  const rowComplete = (row) => row.material_code !== '' && String(row.quantity).trim() !== ''
  const isOpeningRow = components.length === 1 && !rowComplete(components[0])
    && components[0].material_code === '' && String(components[0].quantity).trim() === ''
  const hasPartialRow = !isOpeningRow && components.some((row) => !rowComplete(row))
  // A material may appear once. Counted over the chosen codes rather than the
  // displayed names, for the same reason the row stores the code: the name is a
  // per-language label, and two rows holding the same material would stop
  // looking alike the moment the language changed.
  const chosenCodes = components.map((row) => row.material_code).filter((code) => code !== '')
  const hasDuplicateRow = new Set(chosenCodes).size !== chosenCodes.length
  const componentsValid = components.length > 0 && !isOpeningRow
    && !hasPartialRow && !hasDuplicateRow
  // Step one blocks only on a duplicate code, not on the required fields: an
  // empty form would otherwise open with a dead Next button, the same reason
  // the components step tolerates its opening row.
  const submitBlocked = step === 2 ? !componentsValid : isDuplicateCode

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setDraft((current) => ({ ...current, [field]: value }))
    if (showError) setShowError(false)
    // The outcome described the draft as it was submitted; editing makes it
    // stale, so it goes as soon as anything changes.
    if (outcome !== null) setOutcome(null)
  }

  const goNext = () => {
    // The same check that guards submit, applied before leaving step one:
    // advancing with an unusable header would only fail later, further from
    // the fields at fault.
    if (!isValid) {
      setShowError(true)
      return
    }
    setShowError(false)
    setOutcome(null)
    setStep(2)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (step === 1) {
      goNext()
      return
    }
    if (!isValid) {
      // Recoverable rather than fatal: send the operator back to the step that
      // holds the offending fields instead of reporting it over the table.
      setStep(1)
      setShowError(true)
      return
    }
    // Nothing is reported locally: the line stays empty until the container
    // answers through NewRecipeMessage, so the only success text on screen is
    // one that reflects what actually happened to the row.
    setOutcome(null)
    // Stamped at submit, not at mount: the value should say when the recipe
    // was created, not when the operator opened the form and started typing.
    //
    // Sent as [seconds, nanoseconds] - the same shape a timestamp column
    // arrives in through CreateCards - so the container handles one format in
    // both directions rather than a tuple inbound and a string outbound.
    // Seconds are UTC epoch, which carries no ambiguity about the panel's
    // regional settings.
    //
    // Both columns get the same instant rather than two calls to now(), so a
    // new row cannot appear to have been modified after it was created.
    //
    // Note this is the HMI panel's clock. A server-side column default is the
    // more reliable source; this exists so the rows are not left NULL while
    // there is none.
    const submittedMs = Date.now()
    const submittedAt = [
      Math.floor(submittedMs / 1000),
      // Nanoseconds within the second. Milliseconds is all a browser clock
      // offers, so the lower six digits are always zero rather than invented.
      (submittedMs % 1000) * 1e6,
    ]

    onSubmit?.({
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      created_at: submittedAt,
      updated_at: submittedAt,
      // The local row key is dropped - it exists only so React can track rows
      // while editing, and would be meaningless to the container.
      // A row with no material chosen is an unfilled placeholder, not data.
      // Identified by its code, which is what the row stores - the displayed
      // name is a per-language label and would be the wrong thing to send.
      components: components
        .filter((row) => row.material_code !== '')
        .map(({ key, ...row }) => ({
          ...row,
          quantity: row.quantity === '' ? null : Number(row.quantity),
        })),
    })
  }

  const stepLabel = text.stepOf
    .replace('{current}', String(step))
    .replace('{total}', String(TOTAL_STEPS))

  const showingSuccess = outcome !== null && OUTCOMES[outcome].page

  // The success pane is internal to this component, so the parent cannot see
  // it to name the side page. Reported from an effect rather than during
  // render, since it sets state a level up. Cleared on unmount, so closing the
  // form does not leave 'created' standing as the current pane.
  useEffect(() => {
    onSidePage?.(showingSuccess ? 'created' : null)
    return () => onSidePage?.(null)
  }, [showingSuccess])

  // Takes over the whole pane rather than rendering inside the form: the draft
  // is a row now, so the fields describe nothing pending. The close button
  // stays, so a success sent without a timeout is still dismissible.
  if (showingSuccess) {
    return (
      <div className="new-recipe" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <CloseButton language={language} onClose={onCancel} />
        <RecipeCreated language={language} />
      </div>
    )
  }

  return (
    <div className="new-recipe" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CloseButton language={language} onClose={onCancel} />
      <form className="new-recipe__body" onSubmit={handleSubmit} noValidate>
        <div className="new-recipe__header">
          <h2 className="new-recipe__heading">
{text.heading}</h2>
          <p className="new-recipe__step" aria-live="polite">
            {stepLabel} — {step === 1 ? text.stepDetails : text.stepComponents}
          </p>
        </div>

        {step === 1 ? (
          <div className="new-recipe__fields">
            <label className="new-recipe__field">
              <span className="new-recipe__label">
                {text.code}
                {/* Hidden from assistive tech: aria-required on the input below
                    says the same thing in a way it already understands, so the
                    glyph would only be read out as noise. */}
                <span className="new-recipe__required" aria-hidden="true" title={text.requiredMark}>*</span>
              </span>
              <input
                className="new-recipe__input"
                type="text"
                value={draft.code}
                onChange={update('code')}
                aria-required="true"
                placeholder={text.codePlaceholder}
                /* Codes are an ASCII identifier in every row the list renders,
                   so the field stays LTR even in an RTL layout. */
                dir="ltr"
                autoComplete="off"
              />
            </label>

            <label className="new-recipe__field">
              <span className="new-recipe__label">
                {text.name}
                <span className="new-recipe__required" aria-hidden="true" title={text.requiredMark}>*</span>
              </span>
              <input
                className="new-recipe__input"
                type="text"
                value={draft.name}
                onChange={update('name')}
                aria-required="true"
                placeholder={text.namePlaceholder}
                autoComplete="off"
              />
            </label>

            <label className="new-recipe__field new-recipe__field--wide">
              <span className="new-recipe__label">{text.description}</span>
              <textarea
                className="new-recipe__input new-recipe__textarea"
                value={draft.description}
                onChange={update('description')}
                placeholder={text.descriptionPlaceholder}
                rows={3}
              />
            </label>

            {/* The same pill the detail page uses, so the flag looks alike
                wherever it is set. The label follows the value rather than
                always reading "Active", which would leave an unticked box
                labelled with the state it is not in.

                The checkbox stays, only visually hidden: it is what makes this
                operable by keyboard and reported correctly to a screen reader,
                which a styled span alone would not be. */}
            <label className={'new-recipe__status' +
              (draft.is_active ? '' : ' new-recipe__status--inactive')}>
              <input
                className="new-recipe__status-input"
                type="checkbox"
                checked={draft.is_active}
                onChange={update('is_active')}
              />
              <span>{draft.is_active ? text.active : text.inactive}</span>
            </label>
          </div>
        ) : (
          <RecipeComponents
            language={language}
            materials={materials}
            rows={components}
            // Wrapped rather than passed straight through, so editing the
            // table clears a stale outcome the same way editing a step-one
            // field does.
            onChange={(rows) => {
              setComponents(rows)
              if (outcome !== null) setOutcome(null)
            }}
          />
        )}

        {/* One reserved line carrying whichever message applies, so neither a
            validation failure nor a confirmation shifts the buttons below it.
            Announced rather than only shown, so the reason a submit did
            nothing - or the fact that it worked - reaches a screen reader.

            Success is never written locally: submitting only hands the draft
            over, and whether a row was actually created is something only the
            container knows, so that text arrives through NewRecipeMessage. */}
        <p
          className={'new-recipe__error' + (
            outcome !== null && OUTCOMES[outcome].ok ? ' new-recipe__error--ok' : ''
          )}
          role="alert"
        >
          {outcome !== null
            ? (OUTCOMES[outcome][language] ?? OUTCOMES[outcome].en)
            : isDuplicateCode
              ? text.duplicateCode
              : showError
                ? text.required
                : submitBlocked
                  ? (hasPartialRow
                      ? text.incompleteRows
                      : hasDuplicateRow ? text.duplicateRows : text.noRows)
                  : ''}
        </p>

        <div className="new-recipe__actions">
          <button className="new-recipe__button" type="button" onClick={onCancel}>
            {text.cancel}
          </button>
          {step === 2 && (
            <button
              className="new-recipe__button"
              type="button"
              onClick={() => { setOutcome(null); setStep(1) }}
            >
              {text.back}
            </button>
          )}
          <button
            className="new-recipe__button new-recipe__button--primary"
            type="submit"
            /* Step one stays clickable while fields are merely missing, and
               answers with the error line, since the offending fields are
               right there. It is genuinely disabled for a duplicate code:
               unlike a blank field, that cannot be fixed by pressing on, and
               the message line names the reason. Step two is disabled the same
               way for an incomplete component row. */
            disabled={submitBlocked}
            aria-disabled={(step === 1 && !isValid) || submitBlocked}
          >
            {step === 1 ? text.next : text.save}
          </button>
        </div>
      </form>
    </div>
  )
}
