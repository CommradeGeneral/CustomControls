import { useEffect, useState } from 'react'
import { AlertCircle, Plus, Users } from 'lucide-react'
import { DEFAULT_ASSIGNED_ROLE, assignableBy } from '../../lib/permissions'
import { formatDate, toActive, toText } from '../../lib/containerValues'
import { ADD_OUTCOMES, LOAD_FAILURES } from './outcomes'
import { labels } from './userLabels'
import { UserRow } from './UserRow'
import { NewUserRow } from './NewUserRow'
import './OwnedUsers.css'

// Seeded as a function rather than a shared object literal, so a reopened row
// cannot inherit the previous draft's mutations.
//
// The role starts at the narrowest assignable one rather than blank: a new
// account must not be able to land on a wider role by the operator missing a
// field, and the schema says the same about its own default.
const emptyDraft = () => ({
  username: '',
  displayName: '',
  password: '',
  confirm: '',
  role: DEFAULT_ASSIGNED_ROLE,
})

/**
 * Normalize one account row from the container.
 *
 * The container decides the spelling, so the aliases a query might produce are
 * accepted rather than requiring one. Everything goes through toText so a NULL
 * arriving as the string "null" reads as absent, which is what it is.
 */
function toUserRow(row, index) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (row?.[key] !== undefined && row?.[key] !== null) return row[key]
    }
    return undefined
  }
  const username = toText(pick('username', 'Username'))
  const roleValue = Number(pick('role', 'Role'))
  return {
    // The username is the schema's primary key, so it is the natural React
    // key; the index stands in only for a row that arrived without one.
    key: username || `row-${index}`,
    username,
    displayName: toText(pick('display_name', 'displayName', 'DisplayName')),
    role: Number.isFinite(roleValue) ? roleValue : null,
    isActive: toActive(pick('is_active', 'isActive', 'IsActive')),
    // Carried so the section can work out what a delete would cascade to.
    ownedBy: toText(pick('owned_by', 'ownedBy', 'OwnedBy')),
    lastLogin: formatDate(pick('last_login_at', 'lastLoginAt', 'LastLoginAt')),
  }
}

export function OwnedUsers({ language = 'en', message = null, editMessage = null, owner = '', users = null, usersStatus = -1, onReload, onAddUser, onEditUser, onResetPassword, onDeleteUser, onDismissEdit, callerRole = 0 }) {
  /*
   * The roles this operator may hand out. An administrator offers all three;
   * anyone else is left with the two below administrator, so a supervisor
   * cannot promote anyone - including themselves - past their own level.
   *
   * Derived once here and passed to both rows, so the draft row and an edited
   * row can never offer different lists.
   */
  const roleOptions = assignableBy(callerRole)
  const text = labels[language] ?? labels.en
  // Whether the draft row is open. The row is mounted rather than hidden, so
  // closing it discards the draft with it and a reopened row starts empty.
  /*
   * What the list is showing.
   *
   * Loading is the default and the first thing tested: until LoadUsers
   * answers, the section knows nothing about the accounts, and rendering "no
   * users" then would state something it cannot know. `users` being null is
   * the same condition from the other side - never answered - and both are
   * checked so a status that arrives without rows cannot slip through.
   */
  const loading = usersStatus === -1 || (usersStatus === 0 && users === null)
  const failure = usersStatus > 0
    ? (LOAD_FAILURES[usersStatus] ?? LOAD_FAILURES[3])[language]
      ?? (LOAD_FAILURES[usersStatus] ?? LOAD_FAILURES[3]).en
    : null
  const rows = Array.isArray(users) ? users.map(toUserRow) : []


  // Which listed row is open for editing, by username. One at a time: the
  // container answers with a single message, and two open rows would both
  // claim it.
  const [busyRow, setBusyRow] = useState(null)
  // True while an edit or reset is waiting on the container.
  const [editPending, setEditPending] = useState(false)
  /*
   * The open row, or null once it stops being in the list.
   *
   * A row normally releases this itself on close, but a deleted one is gone
   * from the refreshed rows and unmounts before it can - leaving busyRow
   * naming an account that no longer exists, which hid the edit button on
   * every surviving row.
   *
   * Derived here rather than corrected in an effect: the stale value is never
   * the truth for even one render, and the rows array is rebuilt each time, so
   * an effect depending on it would run on every pass.
   *
   * Checked against the rows rather than handled in the delete path, because a
   * row can vanish for reasons the control never hears about - another
   * operator removing it, or a refresh that no longer includes it.
   */
  const openRow = busyRow !== null && rows.some((row) => row.username === busyRow)
    ? busyRow
    : null

  useEffect(() => {
    if (!editMessage) return
    setEditPending(false)
  }, [editMessage?.seq])


  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  // True from the moment the draft is handed over until the container answers.
  // What stops a second submit while the first is still being written.
  const [pending, setPending] = useState(false)
  // Which container-raised outcome is on screen. Held separately from the
  // `message` prop so it can be cleared by its own timeout, and so an
  // unrecognised code simply shows nothing.
  const [outcome, setOutcome] = useState(null)

  // Keyed on `seq`, so re-sending the same code restarts the countdown rather
  // than leaving the original timer to expire early. The timer is cleared on
  // cleanup: without that a superseded timeout would hide a newer message.
  useEffect(() => {
    if (!message || !ADD_OUTCOMES[message.code]) {
      setOutcome(null)
      // An unrecognised code is still an answer: it ends the wait, or a
      // withdrawn message would leave the row pending forever.
      setPending(false)
      return undefined
    }
    setOutcome(message.code)
    setPending(false)

    if (!ADD_OUTCOMES[message.code].closes) {
      // A failure keeps the row and its values so they can be corrected; the
      // message clears itself after the timeout, leaving the draft behind.
      if (!(message.duration > 0)) return undefined
      const clear = setTimeout(() => setOutcome(null), message.duration)
      return () => clearTimeout(clear)
    }

    /*
     * The account exists, so the fields are emptied - a plaintext password
     * should not sit in a box once it has been handed over - but the row
     * stays open, ready for the next account.
     *
     * Adding users is usually done in a batch, and closing after each one
     * made the operator press New Account again between every pair. The row
     * is dismissed by its own Discard button, which is the one control that
     * means "I am finished".
     */
    setDraft(emptyDraft())

    if (!(message.duration > 0)) return undefined

    // Only the confirmation is on a timer now; the row outlives it.
    const timer = setTimeout(() => setOutcome(null), message.duration)
    return () => clearTimeout(timer)
  }, [message?.seq, message?.code, message?.duration])

  // Compared untrimmed, and deliberately: leading and trailing spaces are
  // legitimate password characters, so trimming would report a match between
  // two strings the container would go on to treat as different.
  //
  // Only reported once the confirmation has something in it, so the row does
  // not accuse the operator of a mismatch they are halfway through typing.
  const mismatch = draft.confirm !== '' && draft.password !== draft.confirm

  // Username and password are required; the display name is optional, since
  // the schema allows it to be NULL and falls back to the username. The
  // confirmation has to match, and the role always has a value.
  //
  // Trimmed for the test but not yet for the value: a username of only spaces
  // is not a username, while a password's spaces are significant and are left
  // alone until it is handed over.
  const canSubmit = draft.username.trim() !== ''
    && draft.password !== ''
    && draft.confirm === draft.password
    && !pending
    && Boolean(onAddUser)

  const startAdding = () => {
    // A fresh draft each time, so a row abandoned earlier does not come back
    // half-filled.
    setDraft(emptyDraft())
    setOutcome(null)
    setPending(false)
    setAdding(true)
  }

  const cancelAdding = () => {
    setAdding(false)
    setPending(false)
    setOutcome(null)
    setDraft(emptyDraft())
  }

  const submitDraft = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    // The username is trimmed on the way out - the operator's stray spaces
    // should not reach a column the schema makes unique - while the password
    // is passed exactly as typed.
    //
    // `confirm` is deliberately not sent: it exists to catch a typo here, and
    // the container has no use for a second copy of the same string.
    onAddUser?.({
      username: draft.username.trim(),
      displayName: draft.displayName.trim(),
      password: draft.password,
      role: draft.role,
      owner: owner,
    })
    // Held open and pending until AddUserMessage answers. Closing here would
    // report success for a write that may still fail, and the operator would
    // have no way back to the values they typed.
    setPending(true)
  }

  return (
    <section className="owned-users" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="owned-users__header">
        <Users className="owned-users__icon" size="1em" strokeWidth={1.5} aria-hidden="true" />
        <div className="owned-users__titles">
          <h2 className="owned-users__heading">{text.heading}</h2>
          <p className="owned-users__hint">{text.hint}</p>
        </div>

        {/* Opens the draft row below rather than navigating anywhere, so the
            operator stays where the accounts are. Hidden while the row is
            open: the row is the thing to finish, and a second press would
            only restart what is already in front of them. */}
        {!adding && (
          <button
            className="owned-users__add"
            type="button"
            onClick={startAdding}
          >
            <Plus size="1em" strokeWidth={2.5} aria-hidden="true" />
            <span>{text.addUser}</span>
          </button>
        )}
      </header>

      {/* The list and the states that stand in for it: loading while the
          container is being asked, the failure it may answer with, the empty
          result, or the accounts themselves. */}
      <div className="owned-users__body">
        {adding && (
          <NewUserRow
            text={text}
            language={language}
            roleOptions={roleOptions}
            draft={draft}
            setDraft={setDraft}
            onCancel={cancelAdding}
            onSubmit={submitDraft}
            canSubmit={canSubmit}
            mismatch={mismatch}
            pending={pending}
            outcome={outcome}
            wired={Boolean(onAddUser)}
          />
        )}

        {/*
          Four states, in the order that decides them. Loading wins: until the
          container answers, the section knows nothing, and showing "no users"
          then would be a claim it cannot make.
        */}
        {loading ? (
          <div className="owned-users__state" role="status" aria-busy="true">
            <div className="owned-users__spinner" aria-hidden="true" />
            <p className="owned-users__state-title">{text.loading}</p>
            <p className="owned-users__state-hint">{text.loadingHint}</p>
          </div>
        ) : failure ? (
          /* alert rather than status: a failure is worth interrupting a
             screen reader for, where a wait is not. */
          <div className="owned-users__state" role="alert">
            <AlertCircle className="owned-users__state-icon" size="1em" aria-hidden="true" />
            <p className="owned-users__state-title">{failure.title}</p>
            <p className="owned-users__state-hint">{failure.hint}</p>
            {/* The control cannot re-run the query, so this only asks the
                container to answer again. */}
            {onReload && (
              <button className="owned-users__reload" type="button" onClick={onReload}>
                {text.retry}
              </button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="owned-users__state">
            <p className="owned-users__state-title">{text.empty}</p>
            <p className="owned-users__state-hint">{text.emptyHint}</p>
          </div>
        ) : (
          <ul className="owned-users__list">
            {rows.map((row) => (
              <UserRow
                key={row.key}
                row={row}
                rows={rows}
                text={text}
                language={language}
                roleOptions={roleOptions}
                // Hidden on every other row while one is open, so the
                // container's single answer cannot be ambiguous.
                editable={Boolean(onEditUser) && (openRow === null || openRow === row.username)}
                pending={editPending && openRow === row.username}
                outcome={openRow === row.username ? editMessage : null}
                onBusy={setBusyRow}
                onDismiss={onDismissEdit}
                onEdit={(draft) => { setEditPending(true); onEditUser?.(draft) }}
                onReset={(draft) => { setEditPending(true); onResetPassword?.(draft) }}
                onDelete={onDeleteUser
                  ? (draft) => { setEditPending(true); onDeleteUser(draft) }
                  : undefined}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
