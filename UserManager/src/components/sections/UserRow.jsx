import { useEffect, useState } from 'react'
import { Check, KeyRound, Pencil, Trash2, X } from 'lucide-react'
import { Select } from '../Select'
import { ASSIGNABLE_ROLES } from '../../lib/permissions'
import { EDIT_OUTCOMES } from './outcomes'

/**
 * How many accounts a delete would take with it.
 *
 * Deleting an account deletes everything beneath it - owned_by is a
 * self-reference, so ownership nests - and the operator is about to press a
 * button that cannot be undone. Counted from the rows already on screen, which
 * is what the container listed, so the figure is a warning rather than a
 * promise: the container may hold rows this operator was not sent, and its own
 * cascade is what decides the real total.
 *
 * Bounded by the row count so a cycle in the data cannot spin here.
 */
function countSubtree(rows, username) {
  let names = [username]
  let total = 1
  for (let guard = 0; guard < rows.length && names.length; guard += 1) {
    const children = rows
      .filter((row) => row.ownedBy && names.includes(row.ownedBy))
      .map((row) => row.username)
      .filter((name) => name !== username)
    if (!children.length) break
    total += children.length
    names = children
  }
  return total
}

/**
 * One listed account, readable or editable in place.
 *
 * Three modes, held here rather than by the section: 'read' is the row as
 * listed, 'edit' swaps the three changeable fields for inputs, and 'reset'
 * asks for a new password instead. Keeping the mode local means opening one
 * row does not disturb the others.
 *
 * Only display_name, role and is_active can be changed. The username is the
 * primary key and the target of owned_by, so renaming it would orphan the
 * accounts it owns; it is shown but never editable. The password is a reset
 * rather than a change, which is why it has its own mode and its own event -
 * the old one is neither known nor asked for.
 */
export function UserRow({ row, rows, text, language, roleOptions, editable, pending, outcome, onEdit, onReset, onDelete, onBusy, onDismiss }) {
  const [mode, setMode] = useState('read')
  const [draft, setDraft] = useState({
    displayName: row.displayName,
    role: row.role,
    isActive: row.isActive,
  })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // True once delete has been pressed and is awaiting its second press.
  const [confirming, setConfirming] = useState(false)
  /*
   * Which action this row is waiting on: 'save' or 'delete'.
   *
   * EditUserMessage answers all three of edit, reset and delete, so a code 0
   * on its own cannot say what succeeded - and reporting "Saved." for a
   * deleted account is wrong in a way the operator would notice. The row
   * knows what it sent, so it is what remembers.
   */
  const [sentAction, setSentAction] = useState('save')

  /*
   * The container answered this row.
   *
   * A failure leaves the row open with its message so the values can be
   * corrected. A success also leaves it open - briefly - so the operator
   * actually sees that it worked: closing on arrival set the message and
   * unmounted the row in the same pass, which meant "Saved." was never on
   * screen for a single frame.
   *
   * The delay is the container's Timeout, which is what that parameter is
   * for. Zero or less holds the message until the operator closes the row
   * themselves, so a container that wants the confirmation acknowledged can
   * ask for that.
   *
   * The timer is cleared on cleanup and keyed on seq: a second answer
   * supersedes the first rather than leaving an older timeout to close a row
   * that has since been reopened.
   */
  useEffect(() => {
    if (!outcome) return undefined
    setConfirming(false)
    if (!EDIT_OUTCOMES[outcome.code]?.closes) return undefined

    // The fields are cleared at once - a plaintext password should not sit in
    // a box while the confirmation is read - but the row stays up.
    setPassword('')
    setConfirm('')

    if (!(outcome.duration > 0)) return undefined

    const timer = setTimeout(() => {
      setMode('read')
      onBusy(null)
    }, outcome.duration)
    return () => clearTimeout(timer)
  }, [outcome?.seq])

  const startEdit = () => {
    // Seeded from the row each time, so an abandoned edit does not come back.
    setDraft({ displayName: row.displayName, role: row.role, isActive: row.isActive })
    setMode('edit')
    onBusy(row.username)
  }

  const startReset = () => {
    setPassword('')
    setConfirm('')
    setMode('reset')
  }

  const cancel = () => {
    setMode('read')
    setPassword('')
    setConfirm('')
    setConfirming(false)
    // The verdict described the attempt being abandoned, so it goes with it.
    // Held in App rather than here, so the row cannot clear it alone.
    onDismiss?.()
    onBusy(null)
  }

  // Compared untrimmed: spaces are legitimate password characters, so trimming
  // would report a match between two strings the container would treat as
  // different.
  const mismatch = confirm !== '' && password !== confirm
  const canSaveReset = password !== '' && password === confirm && !pending

  // The row holds a role this caller cannot assign - an administrator seen by
  // a supervisor, or a value the control has no name for. The dropdown does
  // not offer it, so the button has nothing to display and says what the role
  // is instead. Leaving the field untouched keeps that value; choosing from
  // the list replaces it.
  // How many accounts this delete would remove, including the row itself.
  const doomed = countSubtree(rows, row.username)

  const outsideList = row.role !== null
    && !roleOptions.some((entry) => entry.value === row.role)

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault()
      cancel()
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (mode === 'edit') {
      if (pending) return
      setSentAction('save')
      onEdit({
        username: row.username,
        displayName: draft.displayName.trim(),
        role: draft.role,
        isActive: draft.isActive,
      })
    } else {
      if (!canSaveReset) return
      setSentAction('save')
      onReset({ username: row.username, password })
    }
  }

  const outcomeEntry = outcome ? EDIT_OUTCOMES[outcome.code] : null
  // Only the success needs telling apart: every failure already says what
  // went wrong regardless of which action asked.
  const message = outcomeEntry && outcomeEntry.ok && sentAction === 'delete'
    ? EDIT_OUTCOMES.deleted
    : outcomeEntry

  if (mode === 'read') {
    // A role the control has no name for is still a real role - the container
    // may use values this build has never heard of - so the number is shown
    // rather than the row being blanked.
    const named = ASSIGNABLE_ROLES.find((entry) => entry.value === row.role)
    const roleLabel = named
      ? text.roles[named.key]
      : (row.role === null ? '' : text.role + ' ' + row.role)

    return (
      <li className="owned-users__item">
        <div className="owned-users__item-main">
          <span className="owned-users__item-name">{row.username}</span>
          {row.displayName && (
            <span className="owned-users__item-display">{row.displayName}</span>
          )}
        </div>
        <div className="owned-users__item-meta">
          {roleLabel && <span className="owned-users__item-role">{roleLabel}</span>}
          {/* dir="ltr" on the date: its separators are bidi-neutral, so the
              digit groups would be reordered in an RTL pane. */}
          {row.lastLogin && (
            <span className="owned-users__item-date" dir="ltr">{row.lastLogin}</span>
          )}
          <span className={'owned-users__item-status'
            + (row.isActive ? '' : ' owned-users__item-status--inactive')}>
            {row.isActive ? text.active : text.inactive}
          </span>
          {/* Hidden rather than disabled while another row is open: two rows
              editable at once is a state the container cannot answer, since
              one message would land on both. */}
          {editable && (
            <button
              className="owned-users__item-edit"
              type="button"
              onClick={startEdit}
              aria-label={text.edit + ' ' + row.username}
              title={text.edit}
            >
              <Pencil size="1em" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <li className="owned-users__item owned-users__item--editing">
      <form className="owned-users__edit" onSubmit={submit} onKeyDown={handleKeyDown} noValidate>
        <div className="owned-users__edit-fields">
          {/* Shown but not editable: the row has to say which account is being
              changed, and a field that cannot be edited should not look like
              one that can. */}
          <span className="owned-users__edit-name">{row.username}</span>

          {mode === 'edit' ? (
            <>
              <label className="owned-users__edit-field">
                <span className="owned-users__row-label">{text.displayName}</span>
                <input
                  className="owned-users__row-input"
                  type="text"
                  autoComplete="off"
                  value={draft.displayName}
                  onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                  placeholder={text.displayNamePlaceholder}
                  disabled={pending}
                />
              </label>

              <label className="owned-users__edit-field owned-users__edit-field--role">
                <span className="owned-users__row-label">{text.role}</span>
                {/*
                  Exactly the roles this caller may assign, whatever the row
                  currently holds. A supervisor is never offered
                  administrator, so the section cannot be a route to granting
                  one - which is the same rule onEditUser enforces on the
                  container side.

                  A row already holding a role outside that list shows its
                  number rather than a name, since the list has no entry to
                  match: see the placeholder below.
                */}
                <Select
                  value={draft.role}
                  options={roleOptions.map(({ value, key }) => ({
                    value,
                    label: text.roles[key],
                  }))}
                  placeholder={outsideList ? `${text.role} ${row.role}` : undefined}
                  onChange={(next) => setDraft((d) => ({ ...d, role: next }))}
                  label={text.role}
                  language={language}
                  disabled={pending}
                />
              </label>

              {/*
                The same pill the read-only row shows, made operable: the flag
                is changed where it is read rather than as a checkbox
                elsewhere, and it keeps the green/red so the state stays
                recognisable while it is being edited.

                The checkbox is still there, only visually hidden - it is what
                makes this operable by keyboard and reported correctly to a
                screen reader, which a styled span alone would not be.
              */}
              <label className={'owned-users__item-status owned-users__item-status--editable'
                + (draft.isActive ? '' : ' owned-users__item-status--inactive')}>
                <input
                  className="owned-users__status-input"
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                  disabled={pending}
                />
                <span>{draft.isActive ? text.active : text.inactive}</span>
              </label>
            </>
          ) : (
            <>
              <label className="owned-users__edit-field">
                <span className="owned-users__row-label">{text.newPassword}</span>
                <input
                  className="owned-users__row-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={text.passwordPlaceholder}
                  disabled={pending}
                />
              </label>

              <label className="owned-users__edit-field">
                <span className="owned-users__row-label">{text.confirm}</span>
                <input
                  className={'owned-users__row-input'
                    + (mismatch ? ' owned-users__row-input--invalid' : '')}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={text.confirmPlaceholder}
                  aria-invalid={mismatch}
                  disabled={pending}
                />
              </label>
            </>
          )}

          <div className="owned-users__row-actions">
            {/* Offered from the edit mode only, so the two are one flow rather
                than two buttons competing on the read-only row. */}
            {mode === 'edit' && !confirming && (
              <>
                <button
                  className="owned-users__row-button"
                  type="button"
                  onClick={startReset}
                  disabled={pending}
                  aria-label={text.resetPassword}
                  title={text.resetPassword}
                >
                  <KeyRound size="1em" strokeWidth={2} aria-hidden="true" />
                </button>
                {/* Deleting is irreversible, so one press must not do it: the
                    confirm below is a deliberate second action rather than a
                    dialog, which keeps the whole interaction in the row. */}
                {onDelete && (
                  <button
                    className="owned-users__row-button owned-users__row-button--danger"
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={pending}
                    aria-label={text.deleteUser}
                    title={text.deleteUser}
                  >
                    <Trash2 size="1em" strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </>
            )}

            {confirming && (
              <button
                className="owned-users__row-button owned-users__row-button--danger owned-users__row-button--wide"
                type="button"
                onClick={() => {
                  setConfirming(false)
                  setSentAction('delete')
                  onDelete({ username: row.username })
                }}
                disabled={pending}
              >
                {doomed > 1
                  ? text.confirmDeleteTree.replace('{n}', doomed)
                  : text.confirmDelete}
              </button>
            )}
            {!confirming && (
              <button
                className="owned-users__row-button owned-users__row-button--confirm"
                type="submit"
                disabled={mode === 'edit' ? pending : !canSaveReset}
                aria-label={text.saveChanges}
                title={text.saveChanges}
              >
                <Check size="1em" strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
            <button
              className="owned-users__row-button"
              type="button"
              onClick={cancel}
              disabled={pending}
              aria-label={text.cancel}
              title={text.cancel}
            >
              <X size="1em" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        {pending ? (
          <p className="owned-users__row-note" role="status">{text.savingEdit}</p>
        ) : message ? (
          <p
            className={'owned-users__row-note'
              + (message.ok ? ' owned-users__row-note--ok' : ' owned-users__row-note--error')}
            role="alert"
          >
            {message[language] ?? message.en}
          </p>
        ) : mismatch ? (
          <p className="owned-users__row-note owned-users__row-note--error" role="alert">
            {text.mismatch}
          </p>
        ) : mode === 'reset' ? (
          <p className="owned-users__row-note">{text.resetHint}</p>
        ) : null}
      </form>
    </li>
  )
}
