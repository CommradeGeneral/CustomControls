import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import './ChangePassword.css'

/**
 * Outcomes the container can raise through the ChangePasswordMessage method.
 * Any other number shows nothing, which is how a message is withdrawn.
 *
 * `clears` marks the one outcome it is safe to empty the fields on: the
 * password changed, so what was typed is spent. After a failure the draft is
 * kept, because making the operator retype a long password to correct one
 * field of it is how they end up choosing a shorter one.
 *
 * `field` points the operator at the box to fix, where the container's verdict
 * identifies one. A wrong current password is the only case that does.
 */
const OUTCOMES = {
  0: {
    ok: true,
    clears: true,
    en: 'Password changed.',
    ar: 'تم تغيير كلمة المرور.',
  },
  1: {
    ok: false,
    field: 'current',
    en: 'The current password is not correct.',
    ar: 'كلمة المرور الحالية غير صحيحة.',
  },
  2: {
    ok: false,
    field: 'next',
    en: 'The new password was rejected. Choose a different one.',
    ar: 'تم رفض كلمة المرور الجديدة. اختر كلمة أخرى.',
  },
  3: {
    ok: false,
    en: 'The password could not be saved.',
    ar: 'تعذّر حفظ كلمة المرور.',
  },
}

// Same shape as every other label table in the control, so both halves are
// translated the same way rather than one hardcoding English.
const labels = {
  en: {
    heading: 'Change password',
    hint: 'Set a new password for the signed-in account.',
    current: 'Current password',
    next: 'New password',
    confirm: 'Confirm new password',
    submit: 'Change password',
    submitting: 'Changing…',
    mismatch: 'The new passwords do not match.',
    incomplete: 'Fill in all three fields.',
  },
  ar: {
    heading: 'تغيير كلمة المرور',
    hint: 'تعيين كلمة مرور جديدة للحساب المسجّل دخوله.',
    current: 'كلمة المرور الحالية',
    next: 'كلمة المرور الجديدة',
    confirm: 'تأكيد كلمة المرور الجديدة',
    submit: 'تغيير كلمة المرور',
    submitting: 'جارٍ التغيير…',
    mismatch: 'كلمتا المرور الجديدتان غير متطابقتين.',
    incomplete: 'املأ الحقول الثلاثة.',
  },
}

// Seeded as a function rather than a shared object literal, so a remounted
// section cannot inherit the previous draft's mutations.
const emptyDraft = () => ({ current: '', next: '', confirm: '' })

/**
 * The change-password section.
 *
 * The control never hashes, verifies or stores a password. bcrypt lives
 * container-side in TIA - see sql/tia/onSignIn.js - so this section's whole
 * job is to collect three strings, hand them over, and wait to be told what
 * happened. Two consequences follow from that, and both shape what is below:
 *
 *   - The control cannot know whether the current password was right. Only
 *     the container can say, so the verdict arrives as ChangePasswordMessage
 *     and the form holds a pending state until it does.
 *
 *   - "New and confirm do not match" is the one check that belongs here,
 *     because it needs nothing the control does not already have. Every other
 *     judgement - too short, reused, wrong current password - is the
 *     container's, and guessing at them here would only disagree with it.
 *
 * The submit is guarded by the two conditions the control can actually
 * evaluate: all three fields filled, and the new pair matching. It says which
 * one is unmet rather than sitting greyed out with no explanation.
 *
 * autoComplete is set on each field so a password manager fills the right box,
 * and type="password" is not a security measure - it stops the password being
 * read over the operator's shoulder on a plant floor, which is the actual
 * threat at an HMI panel.
 */
export function ChangePassword({ language = 'en', username = '', message = null, onSubmit }) {
  const text = labels[language] ?? labels.en
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
    if (!message || !OUTCOMES[message.code]) {
      setOutcome(null)
      // An unrecognised code is still an answer: it ends the wait, or a
      // withdrawn message would leave the form pending forever.
      setPending(false)
      return undefined
    }
    setOutcome(message.code)
    setPending(false)
    // The password changed, so what was typed is spent - and leaving a
    // plaintext password sitting in three boxes on a plant floor is the thing
    // to avoid. A failure keeps the draft so it can be corrected.
    if (OUTCOMES[message.code].clears) setDraft(emptyDraft())
    // Zero or less means it stays until the operator edits the form.
    if (!(message.duration > 0)) return undefined
    const timer = setTimeout(() => setOutcome(null), message.duration)
    return () => clearTimeout(timer)
  }, [message?.seq, message?.code, message?.duration])

  /** Update one field, leaving the others alone. */
  const set = (field) => (event) => {
    // Editing clears the previous verdict: it described the values that have
    // just changed, and leaving it up makes a corrected field look
    // still-wrong.
    setOutcome(null)
    setDraft((current) => ({ ...current, [field]: event.target.value }))
  }

  // Compared untrimmed, and deliberately: leading and trailing spaces are
  // legitimate characters in a password, so trimming would report a match
  // between two strings the container would go on to treat as different.
  //
  // Only reported once the confirmation has something in it, so the message
  // does not accuse the operator of a mismatch they are still halfway through
  // typing.
  const mismatch = draft.confirm !== '' && draft.next !== draft.confirm
  const complete = draft.current !== '' && draft.next !== '' && draft.confirm !== ''
  const canSubmit = complete && !mismatch && !pending

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setOutcome(null)
    setPending(true)
    // `confirm` is deliberately not sent: it exists to catch a typo here, and
    // the container has no use for a second copy of the same string.
    //
    // username is echoed from the property rather than typed, so the container
    // can see which account is meant - but it is not authorisation, and the
    // manifest says so.
    onSubmit?.({ username, current: draft.current, next: draft.next })
  }

  // The verdict names a field where it identifies one, so the box to fix is
  // marked rather than left to be inferred from the sentence.
  const failedField = outcome !== null ? OUTCOMES[outcome]?.field : undefined

  return (
    <section className="change-password" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="change-password__header">
        <KeyRound className="change-password__icon" size="1em" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h2 className="change-password__heading">{text.heading}</h2>
          {/* The account being changed is named, so an operator at a shared
              panel can see whose password this is about to change. */}
          <p className="change-password__hint">
            {text.hint}{username ? ` (${username})` : ''}
          </p>
        </div>
      </header>

      {/* A real form, so Enter submits from any field rather than doing
          nothing - an HMI operator will press it. */}
      <form className="change-password__fields" onSubmit={handleSubmit} noValidate>
        <label className="change-password__field">
          <span className="change-password__label">{text.current}</span>
          <input
            className={'change-password__input' +
              (failedField === 'current' ? ' change-password__input--invalid' : '')}
            type="password"
            autoComplete="current-password"
            value={draft.current}
            onChange={set('current')}
            disabled={pending}
            aria-invalid={failedField === 'current'}
          />
        </label>

        <label className="change-password__field">
          <span className="change-password__label">{text.next}</span>
          <input
            className={'change-password__input' +
              (failedField === 'next' ? ' change-password__input--invalid' : '')}
            type="password"
            autoComplete="new-password"
            value={draft.next}
            onChange={set('next')}
            disabled={pending}
            aria-invalid={failedField === 'next'}
          />
        </label>

        <label className="change-password__field">
          <span className="change-password__label">{text.confirm}</span>
          <input
            className={'change-password__input' +
              (mismatch ? ' change-password__input--invalid' : '')}
            type="password"
            autoComplete="new-password"
            value={draft.confirm}
            onChange={set('confirm')}
            disabled={pending}
            // The message below is this field's error, so it is named as the
            // field's description rather than left to be found by position.
            aria-invalid={mismatch}
            aria-describedby={mismatch ? 'change-password-mismatch' : undefined}
          />
        </label>

        {/* alert rather than status: a mismatch is worth interrupting a screen
            reader for, since the operator is mid-task and about to submit. */}
        {mismatch && (
          <p className="change-password__error" id="change-password-mismatch" role="alert">
            {text.mismatch}
          </p>
        )}

        {/* The container's verdict. Shares the error line's treatment, so the
            form has a single place an operator looks for what went wrong, and
            turns green on the one outcome that is not a failure. */}
        {!mismatch && outcome !== null && OUTCOMES[outcome] && (
          <p
            className={'change-password__error' +
              (OUTCOMES[outcome].ok ? ' change-password__error--ok' : '')}
            role="alert"
          >
            {OUTCOMES[outcome][language] ?? OUTCOMES[outcome].en}
          </p>
        )}

        <div className="change-password__actions">
          {/* Names the unmet condition rather than leaving a greyed-out button
              unexplained. Only the two the control can actually judge appear
              here; everything else is the container's to report. */}
          <p className="change-password__note">
            {!complete ? text.incomplete : mismatch ? text.mismatch : ''}
          </p>
          <button
            className="change-password__button"
            type="submit"
            disabled={!canSubmit}
          >
            {pending ? text.submitting : text.submit}
          </button>
        </div>
      </form>
    </section>
  )
}
