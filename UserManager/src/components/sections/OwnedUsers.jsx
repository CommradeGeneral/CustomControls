import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Plus, Users, X } from 'lucide-react'
import { Select } from '../Select'
import { ASSIGNABLE_ROLES, DEFAULT_ASSIGNED_ROLE } from '../../lib/permissions'
import { formatDate, toActive, toText } from '../../lib/containerValues'
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
 * Outcomes the container can raise through the AddUserMessage method.
 * Any other number shows nothing, which is how a message is withdrawn.
 *
 * `closes` marks the one outcome the row can be dismissed on: the account
 * exists, so the draft has nothing left to describe. A failure keeps the row
 * so it can be corrected, except that the password fields are cleared with it
 * - retyping a password is a small cost against leaving a plaintext one in a
 * field on a plant floor.
 *
 * `field` points the operator at the box to fix where the verdict identifies
 * one.
 */
const ADD_OUTCOMES = {
  0: { ok: true, closes: true, en: 'Account created.', ar: 'تم إنشاء الحساب.' },
  1: {
    ok: false,
    field: 'username',
    en: 'That username is already taken.',
    ar: 'اسم المستخدم مستخدم بالفعل.',
  },
  2: {
    ok: false,
    field: 'password',
    en: 'The password was rejected. Choose a different one.',
    ar: 'تم رفض كلمة المرور. اختر كلمة أخرى.',
  },
  3: {
    ok: false,
    en: 'The database could not be reached. Try again.',
    ar: 'تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.',
  },
  // Kept apart from 3 because it means something different to the operator:
  // a database error is worth retrying, a refused request is not.
  4: {
    ok: false,
    field: 'role',
    en: 'That role cannot be assigned.',
    ar: 'لا يمكن تعيين هذا الدور.',
  },
}

/**
 * What the list shows in place of rows when LoadUsers reports a failure.
 *
 * Keyed by the same numbers the method declares. Anything not listed is an
 * unspecified failure, which is what 3 already says, so an unknown code
 * reports something true rather than nothing at all.
 */
const LOAD_FAILURES = {
  1: {
    en: { title: 'Could not load the accounts', hint: 'The database could not be reached.' },
    ar: { title: 'تعذّر تحميل الحسابات', hint: 'تعذّر الوصول إلى قاعدة البيانات.' },
  },
  2: {
    en: { title: 'Not permitted', hint: 'Your role does not allow listing accounts.' },
    ar: { title: 'غير مسموح', hint: 'دورك لا يسمح بعرض الحسابات.' },
  },
  3: {
    en: { title: 'Could not load the accounts', hint: 'The request did not complete.' },
    ar: { title: 'تعذّر تحميل الحسابات', hint: 'لم يكتمل الطلب.' },
  },
}

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
    lastLogin: formatDate(pick('last_login_at', 'lastLoginAt', 'LastLoginAt')),
  }
}

/** One listed account. */
function UserRow({ row, text }) {
  // A role the control has no name for is still a real role - the container
  // may use values this build has never heard of - so the number is shown
  // rather than the row being blanked.
  const named = ASSIGNABLE_ROLES.find((entry) => entry.value === row.role)
  const roleLabel = named
    ? text.roles[named.key]
    : (row.role === null ? '' : `${text.role} ${row.role}`)

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
      </div>
    </li>
  )
}

/**
 * The draft row: the fields for one new account, in the list's own shape.
 *
 * A row rather than a panel, so adding an account happens where the accounts
 * are and the list does not go away while it is happening. Kept as its own
 * component so the section above stays a description of what it contains.
 *
 * The fields mirror app_user's own columns - see sql/01_users.sql. `role`,
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
function NewUserRow({ text, language, draft, setDraft, onCancel, onSubmit, canSubmit, mismatch, wired, pending, outcome }) {
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
            options={ASSIGNABLE_ROLES.map(({ value, key }) => ({
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

// Same shape as every other label table in the control, so both halves are
// translated the same way rather than one hardcoding English.
const labels = {
  en: {
    heading: 'Users',
    hint: 'The accounts this user manages.',
    addUser: 'Add user',
    username: 'Username',
    usernamePlaceholder: 'Login name',
    displayName: 'Display name',
    displayNamePlaceholder: 'Optional',
    password: 'Password',
    passwordPlaceholder: 'Initial password',
    confirm: 'Confirm',
    confirmPlaceholder: 'Repeat password',
    role: 'Role',
    // Keyed by the role's own name rather than its number, so the table does
    // not have to be re-read when a value changes.
    roles: { user: 'User', supervisor: 'Supervisor', admin: 'Administrator' },
    save: 'Create user',
    saving: 'Creating…',
    cancel: 'Discard',
    required: 'A username and a password are required.',
    mismatch: 'The passwords do not match.',
    notWired: 'Not connected yet: this row reports nothing to the container.',
    loading: 'Loading accounts',
    loadingHint: 'Asking the container for the accounts this user manages.',
    retry: 'Try again',
    active: 'Active',
    inactive: 'Inactive',
    empty: 'No users to display',
    emptyHint: 'The container has not supplied any accounts yet.',
  },
  ar: {
    heading: 'المستخدمون',
    hint: 'الحسابات التي يديرها هذا المستخدم.',
    addUser: 'إضافة مستخدم',
    username: 'اسم المستخدم',
    usernamePlaceholder: 'اسم الدخول',
    displayName: 'الاسم المعروض',
    displayNamePlaceholder: 'اختياري',
    password: 'كلمة المرور',
    passwordPlaceholder: 'كلمة المرور الأولية',
    confirm: 'التأكيد',
    confirmPlaceholder: 'أعد إدخال كلمة المرور',
    role: 'الدور',
    roles: { user: 'مستخدم', supervisor: 'مشرف', admin: 'مسؤول' },
    save: 'إنشاء المستخدم',
    saving: 'جارٍ الإنشاء…',
    cancel: 'تجاهل',
    required: 'اسم المستخدم وكلمة المرور مطلوبان.',
    mismatch: 'كلمتا المرور غير متطابقتين.',
    notWired: 'غير متصل بعد: هذا الصف لا يُبلغ الحاوي بشيء.',
    loading: 'جارٍ تحميل الحسابات',
    loadingHint: 'يتم طلب الحسابات التي يديرها هذا المستخدم من الحاوي.',
    retry: 'أعد المحاولة',
    active: 'نشط',
    inactive: 'غير نشط',
    empty: 'لا يوجد مستخدمون للعرض',
    emptyHint: 'لم يرسل الحاوي أي حسابات بعد.',
  },
}

/**
 * The owned-users section.
 *
 * Layout only: the header, the Add user button and the empty state are real,
 * and the list that belongs underneath is not wired.
 *
 * Add user opens a draft row inline in the list rather than a panel over it,
 * so the accounts stay visible while one is being added and the operator does
 * not leave the tab they chose. The row's own fields are live; its confirm is
 * disabled until an `onAddUser` is supplied, so it cannot submit into nothing.
 *
 * Creating a user needs a contract this manifest does not declare - an event
 * carrying the draft, and a method reporting the outcome - and it needs more
 * care than the recipe equivalent did: a new account's password crosses the
 * same boundary as the change-password form's, so the container must hash it.
 *
 * ---------------------------------------------------------------------------
 * When this is wired up
 * ---------------------------------------------------------------------------
 *
 * components/ItemList is already written and is what goes in the body below:
 * a searchable, paged card list with loading, failed and empty states. It is
 * domain-neutral - title, subtitle, status, two timestamps - so an app_user
 * row needs only an alias entry in components/buildCards.js rather than a new
 * component. `username` maps to the title, `display_name` to the subtitle.
 *
 * It reads rows from a contract this manifest does not currently declare, so
 * wiring it in means restoring the methods it needs as well as the import:
 * something to deliver the rows, and something to say what the list shows
 * while they are awaited. The pair already exists in the git history of this
 * project as CreateItems and LoadingItemsMessage.
 *
 * One thing to settle before the rows are real: "owned" has no column behind
 * it. app_user has no owner_id or created_by, so which accounts a user manages
 * has to be either decided by the container - the safer reading, since the
 * rows never leave TIA unless it sends them - or given a column of its own.
 * Filtering a full list inside the control would be display only, and reading
 * it as a permission boundary would be a mistake.
 */
export function OwnedUsers({ language = 'en', message = null, owner = '', users = null, usersStatus = -1, onReload, onAddUser }) {
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
    // The account exists now, so the row has nothing left to describe - and a
    // plaintext password should not sit in a field any longer than it must.
    if (ADD_OUTCOMES[message.code].closes) {
      setAdding(false)
      setDraft(emptyDraft())
    }
    if (!(message.duration > 0)) return undefined
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

      {/* Where ItemList goes. Until then the empty state stands in for it, so
          the section has a body rather than collapsing to its header. */}
      <div className="owned-users__body">
        {adding && (
          <NewUserRow
            text={text}
            language={language}
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
              <UserRow key={row.key} row={row} text={text} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
