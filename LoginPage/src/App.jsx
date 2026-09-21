import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import LanguageDropdown from './components/LanguageDropdown'
import LoginForm from './components/LoginForm'
import { useBridge } from './hooks/useBridge'
import 'overlayscrollbars/styles/overlayscrollbars.css'
import './index.css'
import './App.css'

/**
 * The control: one sign-in card.
 *
 * Holds no state of its own. Everything the container owns lives in useBridge,
 * so what remains here is the wiring between it and the layout.
 *
 * Owns no part of the WebCC handshake either - code.js does that in <head>
 * before this module is parsed.
 */
function App() {
  const { ready, language, loginMessage, fire } = useBridge()

  // The document, not the control: an RTL language has to reach the root for
  // scrollbars and text selection to follow it, which a nested dir cannot do.
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  // Inside a container, nothing is rendered until the handshake succeeds: the
  // UI would otherwise flash default property values before TIA supplies the
  // real ones. Standalone there is nothing to wait for, so `ready` starts true.
  if (!ready) return null

  return (
    <div className="login-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <LoginForm
        language={language}
        message={loginMessage}
        // Purely outbound: the container owns authentication, so the card only
        // reports the attempt and waits for LoginMessage to answer.
        onSubmit={(user) => fireCredentials('onSignIn', user, fire)}
      />

      <div className="login-container__language">
        <LanguageDropdown
          language={language}
          // A round trip: the language is the container's property to set, so
          // this only reports the change and waits for it to come back.
          onSelect={(value) => fire('onLanguageChange', value)}
        />
      </div>
    </div>
  )
}

/**
 * Send credentials as a JSON string.
 *
 * Guarded because the payload is assembled from operator input: a value that
 * cannot be serialized would otherwise throw out of the event handler and
 * leave the card looking as though nothing happened.
 */
function fireCredentials(event, user, fire) {
  try {
    fire(event, JSON.stringify(user))
  } catch (error) {
    console.warn(`[LoginPage] ${event}: credentials are not serializable`, error)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
