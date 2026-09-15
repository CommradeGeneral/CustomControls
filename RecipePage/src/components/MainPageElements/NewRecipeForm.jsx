import { useEffect, useState } from 'react'
import { CloseButton } from './CloseButton'
import { RecipeComponents, emptyComponent } from './RecipeComponents'
import './NewRecipeForm.css'

/**
 * Outcomes the container can raise through the NewRecipeMessage method.
 * Any other number shows nothing, which is how a message is withdrawn.
 */
const OUTCOMES = {
  0: {
    ok: true,
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
    active: 'Active',
    requiredMark: 'required',
    codePlaceholder: 'RC-0000',
    namePlaceholder: 'Recipe name',
    descriptionPlaceholder: 'What this recipe produces',
    save: 'Create recipe', cancel: 'Cancel', next: 'Next', back: 'Back',
    required: 'Code and name are required.',
    incompleteRows: 'Every component row needs a material and a quantity.',
    noRows: 'Add at least one component.',
    duplicateRows: 'Each material can only appear once.',
    stepDetails: 'Details', stepComponents: 'Components',
    stepOf: 'Step {current} of {total}',
  },
  ar: {
    heading: 'وصفة جديدة',
    code: 'الرمز', name: 'الاسم', description: 'الوصف',
    active: 'نشطة',
    requiredMark: 'مطلوب',
    codePlaceholder: 'RC-0000',
    namePlaceholder: 'اسم الوصفة',
    descriptionPlaceholder: 'ما تنتجه هذه الوصفة',
    save: 'إنشاء الوصفة', cancel: 'إلغاء', next: 'التالي', back: 'رجوع',
    required: 'الرمز والاسم مطلوبان.',
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
export function NewRecipeForm({ language = 'en', message = null, onSubmit, onCancel }) {
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
    // Zero or less means the message stays until the form is closed or edited.
    if (!(message.duration > 0)) return undefined
    const timer = setTimeout(() => setOutcome(null), message.duration)
    return () => clearTimeout(timer)
  }, [message?.seq, message?.code, message?.duration])

  const isValid = draft.code.trim() !== '' && draft.name.trim() !== ''

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
  const submitBlocked = step === 2 && !componentsValid

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
    onSubmit?.({
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
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

  return (
    <div className="new-recipe" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CloseButton language={language} onClose={onCancel} />
      <form className="new-recipe__body" onSubmit={handleSubmit} noValidate>
        <div className="new-recipe__header">
          <h2 className="new-recipe__heading">{text.heading}</h2>
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

            <label className="new-recipe__checkbox">
              <input type="checkbox" checked={draft.is_active} onChange={update('is_active')} />
              <span>{text.active}</span>
            </label>
          </div>
        ) : (
          <RecipeComponents
            language={language}
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
            /* Step one stays clickable and answers with the error line, since
               the offending fields are right there. Step two is genuinely
               disabled, because an incomplete component row cannot be reported
               against a single field - the reason is spelled out in the
               message line above instead, so the dead button is never
               unexplained. */
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
