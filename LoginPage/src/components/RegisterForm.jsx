/**
 * Register card: heading, credential fields, live rule checklist, and submit.
 *
 * Mirrors LoginForm — same card classes from LoginForm.css, so the two views
 * share one visual definition and cannot drift apart. The language code is
 * owned by the caller and `onSwitch` asks the caller to show the login view.
 *
 * Unlike LoginForm the inputs are controlled: the rule list has to react to
 * every keystroke, so the field values live here. They are never sent
 * anywhere — `onSubmit` fires an argument-less contract event.
 */
import { useEffect, useState } from 'react'
import './LoginForm.css'

const Labels = {
  "Register": { "en": "Register", "ar": "إنشاء حساب" },
  "username": { "en": "username", "ar": "اسم المستخدم" },
  "password": { "en": "password", "ar": "كلمة المرور" },
  "confirm password": { "en": "confirm password", "ar": "تأكيد كلمة المرور" },
  "sign up": { "en": "Sign up", "ar": "إنشاء حساب" },
  "have account": { "en": "Already have an account?", "ar": "لديك حساب بالفعل؟" },
  "sign in": { "en": "Sign in", "ar": "دخول" },
}

/**
 * Messages the container can raise by code through the RegisterMessage method.
 * Any other code shows nothing, as specified.
 *
 * Numbered from 3 so the register codes never collide with LoginForm's 1 and 2:
 * the two cards have separate methods, and a code means one thing project-wide.
 */
const Messages = {
  3: {
    "en": "Username already exists",
    "ar": "اسم المستخدم موجود بالفعل"
  },
}

/** Length of the CSS opacity transition, kept in step with LoginForm.css. */
const FADE_MS = 400

/**
 * The sign-up rules, in display order.
 *
 * "8 letters" is read as 8 characters: the username rule deliberately allows
 * digits and underscore, so a letters-only count would contradict it.
 */
const Rules = [
  {
    key: 'userLength',
    label: {
      "en": "Username is at least 8 characters",
      "ar": "اسم المستخدم 8 أحرف على الأقل"
    },
    // `watches` names the fields a rule judges. A rule only turns red once one
    // of its own fields has content, so typing a username cannot fault the
    // password rules.
    watches: ['username'],
    test: ({ username }) => username.length >= 8
  },
  {
    key: 'userCharset',
    label: {
      "en": "Username uses only Latin letters, numbers or underscore",
      "ar": "اسم المستخدم يحتوي على حروف لاتينية أو أرقام أو شرطة سفلية فقط"
    },
    watches: ['username'],
    // Anchored and applied to the whole value, so one bad character fails it.
    test: ({ username }) => /^[A-Za-z0-9_]+$/.test(username)
  },
  {
    key: 'passLength',
    label: {
      "en": "Password is at least 8 characters",
      "ar": "كلمة المرور 8 أحرف على الأقل"
    },
    watches: ['password'],
    test: ({ password }) => password.length >= 8
  },
  {
    key: 'passMatch',
    label: {
      "en": "Passwords match",
      "ar": "كلمتا المرور متطابقتان"
    },
    // Only judged once the confirm field is being filled in: a mismatch is not
    // the operator's mistake while they have yet to type the confirmation.
    watches: ['confirm'],
    // Guarded on empty so the rule does not read as satisfied before typing.
    test: ({ password, confirm }) => password.length > 0 && password === confirm
  },
]

/**
 * Rule display state: 'passed', 'failed', or 'pending'.
 *
 * 'pending' is the untouched state — grey, no judgement. A rule only reports
 * failure once the operator has actually typed into a field it watches.
 */
function ruleState(rule, values) {
  if (rule.test(values)) return 'passed'
  return rule.watches.some((field) => values[field].length > 0)
    ? 'failed'
    : 'pending'
}

export default function RegisterForm({ language, message, onSwitch, onSubmit }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // Which message is on screen, and whether it is mid-fade. Held separately
  // from the `message` prop so the text survives the fade-out animation.
  const [shown, setShown] = useState(null)
  const [fading, setFading] = useState(false)

  // Keyed on `seq`, so re-sending the same code restarts the countdown rather
  // than leaving the original timer to expire early. Both timers are cleared
  // on cleanup: without that, a superseded fade would hide a newer message.
  useEffect(() => {
    if (!message || !Messages[message.code]) {
      setShown(null)
      setFading(false)
      return
    }

    setShown(message.code)
    setFading(false)

    if (!(message.duration > 0)) return

    const fadeTimer = setTimeout(() => setFading(true), message.duration)
    const clearTimer = setTimeout(() => setShown(null), message.duration + FADE_MS)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
    }
  }, [message?.seq, message?.code, message?.duration])

  const values = { username, password, confirm }
  const results = Rules.map((rule) => ({ ...rule, state: ruleState(rule, values) }))
  const allPassed = results.every((rule) => rule.state === 'passed')

  return (
    <div className="login-card">
      <h1 className="login-title">
        {Labels["Register"][language] || "Register"}
      </h1>
      <div className="login-fields">
        <input
          type="text"
          placeholder={Labels["username"][language]}
          value={username}
          onChange={(e) => setUsername(e.target.value)} />
        <input
          type="password"
          placeholder={Labels["password"][language]}
          value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <input
          type="password"
          placeholder={Labels["confirm password"][language]}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <ul className="rule-list">
        {results.map(({ key, label, state }) => (
          <li key={key} className={`rule rule-${state}`}>
            {/* Decorative: the pass/fail state is carried for assistive tech by
                the list item's aria-checked, not by this glyph. */}
            <span className="rule-mark" aria-hidden="true">
              {state === 'passed' ? '✓' : state === 'failed' ? '✕' : '•'}
            </span>
            <span role="checkbox" aria-checked={state === 'passed'}>
              {label[language] || label["en"]}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="submit-button"
        disabled={!allPassed}
        onClick={() => onSubmit({ username, password })}>
        {Labels["sign up"][language]}
      </button>
      {shown && Messages[shown] && (
        <p
          className={fading ? 'login-message is-fading' : 'login-message'}
          role="alert">
          {Messages[shown][language] || Messages[shown]["en"]}
        </p>
      )}
      <p className="login-signup">
        {Labels["have account"][language]}{' '}
        <button type="button" className="signup-link" onClick={onSwitch}>
          {Labels["sign in"][language]}
        </button>
      </p>
    </div>
  )
}
