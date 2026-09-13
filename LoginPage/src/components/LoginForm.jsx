/**
 * Login card: heading, credential fields, submit, and the sign-up line.
 *
 * Purely presentational — the language code is owned by the caller so the
 * container can drive it through the `Language` property, exactly as
 * LanguageDropdown does. The card reads its writing direction from the
 * ancestor that sets `direction`, so nothing here is LTR-specific.
 */
import { useEffect, useState } from 'react'
import './LoginForm.css'

const Labels = {
  "Login": { "en": "Login", "ar": "تسجيل الدخول" },
  "username": { "en": "username", "ar": "اسم المستخدم" },
  "password": { "en": "password", "ar": "كلمة المرور" },
  "sign in": { "en": "Sign in", "ar": "دخول" },
  "no account": { "en": "Don't have an account?", "ar": "ليس لديك حساب؟" },
  "sign up": { "en": "Sign up", "ar": "إنشاء حساب" },
}

/**
 * Messages the container can raise by code through the LoginMessage method.
 * Any other code shows nothing, as specified.
 */
const Messages = {
  1: {
    "en": "Either username or password is invalid",
    "ar": "اسم المستخدم أو كلمة المرور غير صحيحة"
  },
  2: {
    "en": "Username is not properly formatted",
    "ar": "تنسيق اسم المستخدم غير صحيح"
  },
}

/** Length of the CSS opacity transition, kept in step with LoginForm.css. */
const FADE_MS = 400

export default function LoginForm({ language, message, onSwitch, onSubmit }) {
  // Controlled so the entered credentials can be handed to `onSubmit`; the
  // values live here and are not read by anything else in the tree.
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // Which message is on screen, and whether it is mid-fade. Held separately
  // from the `message` prop so the text survives the fade-out animation.
  const [shown, setShown] = useState(null)
  const [fading, setFading] = useState(false)

  // Trimmed, so a field holding only spaces still counts as empty.
  const canSubmit = username.trim() !== '' && password.trim() !== ''

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

  return (
    <div className="login-card">
      <h1 className="login-title">
        {Labels["Login"][language] || "Login"}
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
      </div>
      <button
        type="button"
        className="submit-button"
        disabled={!canSubmit}
        onClick={() => onSubmit({ username, password })}>
        {Labels["sign in"][language]}
      </button>
      {shown && Messages[shown] && (
        <p
          className={fading ? 'login-message is-fading' : 'login-message'}
          role="alert">
          {Messages[shown][language] || Messages[shown]["en"]}
        </p>
      )}
      <p className="login-signup">
        {Labels["no account"][language]}{' '}
        <button type="button" className="signup-link" onClick={onSwitch}>
          {Labels["sign up"][language]}
        </button>
      </p>
    </div>
  )
}
