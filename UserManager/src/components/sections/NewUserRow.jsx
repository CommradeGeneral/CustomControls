import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import { Select } from '../Select'
import { ADD_OUTCOMES } from './outcomes'

/**
 * The draft row: the fields for one new account, in the list's own shape.
 *
 * A row rather than a panel, so adding an account happens where the accounts
 * are and the list does not go away while it is happening. Kept as its own
 * component so the section above stays a description of what it contains.
 *
 * The fields mirror dbo.users' own columns. `role`,
 * `is_active` and the lockout columns are deliberately absent: the first two
 * have database defaults that mean "least privileged" and "enabled", which is
 * the right state for a newly created account, and the rest are operational
 * rather than something to type.
 *
 * The password is collected but never hashed here. bcrypt lives container-side
 * in TIA, exactly as it does for the change-password form, so this row's whole
 * job is to hand over three strings.
 */
// Takes `text` rather than `language`: every string it renders is already in
// the table the section resolved, so a second lookup here could only disagree.
export function NewUserRow({ text, language, roleOptions, draft, setDraft, onCancel, onSubmit, canSubmit, mismatch, wired, pending, outcome }) {
  const firstFieldRef = useRef(null)

  // Focus the first field when the row opens: the operator pressed a button to
  // get here, so the caret should already be where they are about to type.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const set = (field) => (event) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }))

  // Escape abandons the row from any field, which is what a keyboard user
  // expects of an inline editor and saves reaching for the cancel button.
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <form
      className="owned-users__row"
      onSubmit={onSubmit}
      onKeyDown={handleKeyDown}
      noValidate
      aria-label={text.addUser}
    >
      <div className="owned-users__row-fields">
        <label className="owned-users__row-field">
          <span className="owned-users__row-label">{text.username}</span>
          <input
            ref={firstFieldRef}
            className="owned-users__row-input"
            type="text"
            autoComplete="off"
            // The username is the login name and the schema's unique key, so
            // it is the one field that cannot be left blank.
            value={draft.username}
            onChange={set('username')}
            placeholder={text.usernamePlaceholder}
            disabled={pending}
          />
        </label>

        <label className="owned-users__row-field">
          <span className="owned-users__row-label">{text.displayName}</span>
          <input
            className="owned-users__row-input"
            type="text"
            autoComplete="off"
            value={draft.displayName}
            onChange={set('displayName')}
            placeholder={text.displayNamePlaceholder}
            disabled={pending}
          />
        </label>

        {/*
          The password and its confirmation are grouped rather than left as
          two fields among five: they are one decision entered twice, and the
          row wraps, so ungrouped they could land on separate lines with the
          display name between them - which is where a mismatch is easiest to
          make and hardest to spot. The pair stays side by side and equally
          wide, or wraps together.
        */}
        <div className="owned-users__row-pair">
          <label className="owned-users__row-field">
            <span className="owned-users__row-label">{text.password}</span>
            <input
              className="owned-users__row-input"
              type="password"
              autoComplete="new-password"
              value={draft.password}
              onChange={set('password')}
              placeholder={text.passwordPlaceholder}
              disabled={pending}
            />
          </label>

          <label className="owned-users__row-field">
            <span className="owned-users__row-label">{text.confirm}</span>
            <input
              className={'owned-users__row-input' +
                (mismatch ? ' owned-users__row-input--invalid' : '')}
              type="password"
              autoComplete="new-password"
              value={draft.confirm}
              onChange={set('confirm')}
              placeholder={text.confirmPlaceholder}
              aria-invalid={mismatch}
              disabled={pending}
            />
          </label>
        </div>

        <label className="owned-users__row-field owned-users__row-field--role">
          <span className="owned-users__row-label">{text.role}</span>
          {/*
            A listbox built from divs rather than a native select, so the
            open list is the page's to style - the OS-drawn popup resolved
            its font against the document root and came up larger than the
            control, and its colours and row height were out of reach too.

            The value stays a number the whole way through, which a native
            select cannot do: its value is always a string, and the contract
            and the schema both want an integer.
          */}
          <Select
            value={draft.role}
            options={roleOptions.map(({ value, key }) => ({
              value,
              label: text.roles[key],
            }))}
            onChange={(next) =>
              setDraft((current) => ({ ...current, role: next }))}
            label={text.role}
            language={language}
            disabled={pending}
          />
        </label>

        <div className="owned-users__row-actions">
          {/* Icon buttons: the row is already tight, and the two actions are
              the conventional pair an inline editor ends with. Each carries a
              label for the name a screen reader reads. */}
          <button
            className="owned-users__row-button owned-users__row-button--confirm"
            type="submit"
            disabled={!canSubmit}
            aria-label={text.save}
            title={text.save}
          >
            <Check size="1em" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            className="owned-users__row-button"
            type="button"
            onClick={onCancel}
            aria-label={text.cancel}
            title={text.cancel}
          >
            <X size="1em" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Says why the row cannot be submitted rather than leaving a greyed-out
          tick unexplained. The mismatch is named before the missing fields,
          since it is the one the operator can see is wrong; the unwired case
          is named separately, being the control's state rather than their
          mistake. */}
      {outcome !== null && ADD_OUTCOMES[outcome] ? (
        <p
          className={'owned-users__row-note'
            + (ADD_OUTCOMES[outcome].ok ? ' owned-users__row-note--ok' : ' owned-users__row-note--error')}
          role="alert"
        >
          {ADD_OUTCOMES[outcome][language] ?? ADD_OUTCOMES[outcome].en}
        </p>
      ) : pending ? (
        <p className="owned-users__row-note" role="status">{text.saving}</p>
      ) : !wired ? (
        <p className="owned-users__row-note">{text.notWired}</p>
      ) : mismatch ? (
        <p className="owned-users__row-note owned-users__row-note--error" role="alert">
          {text.mismatch}
        </p>
      ) : !canSubmit && (
        <p className="owned-users__row-note">{text.required}</p>
      )}
    </form>
  )
}
