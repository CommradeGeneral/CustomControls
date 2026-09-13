/**
 * Recipe list UI.
 *
 * Owns no part of the WebCC handshake — code.js does that in <head> before this
 * module is parsed. React only subscribes to window.RecipeBridge, so adding a
 * framework cannot affect contract registration.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'overlayscrollbars/styles/overlayscrollbars.css'
import './index.css'
import './App.css'
// Imported rather than referenced by path: the control ships as one inlined
// HTML file served from /screen_modules/, where a relative asset URL would
// not resolve. Vite turns this into a data URI that survives the bundle.
import backgroundUrl from './assets/elsisi.webp'
import { langConfigs } from './langConfigs'
import LanguageDropdown from './components/LanguageDropdown'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'


function App() {
  const bridge = window.RecipeBridge
  const [language, setLanguage] = useState('en');
  // Which card is showing. Deliberately local: the container drives language
  // but has no say in the login/register view, so this needs no contract event.
  const [view, setView] = useState('login');
  // Message shown under the sign-in button, set by the container's
  // LoginMessage method. `seq` makes every call distinct, so re-sending the
  // same code restarts the fade rather than being ignored as equal state.
  //
  // Volatile by design: it is never written to a WebCC property or to browser
  // storage, so a recreated control comes up with no message, and leaving the
  // login view drops it (see `switchView`) rather than letting a stale error
  // reappear over freshly entered credentials.
  const [loginMessage, setLoginMessage] = useState(null);
  // Same contract as loginMessage, for the register card. Kept separate so a
  // message raised against one card can never surface on the other.
  const [registerMessage, setRegisterMessage] = useState(null);

  // Changing view discards the message. LoginForm keeps its own copy of the
  // text so it can outlive the fade, but that copy dies with the unmount while
  // this one would not — leaving the old error to re-show, and never fade,
  // when the login card came back.
  const switchView = (next) => {
    setLoginMessage(null);
    setRegisterMessage(null);
    setView(next);
  };
  useEffect(() => {
    bridge.onLanguage = (val) => {
      // The container may hand over an empty/unknown value before the tag is
      // resolved; keep the last good language rather than blanking the labels.
      const code = typeof val === 'string' ? val.trim().toLowerCase() : ''
      if (langConfigs['dir'][code]) setLanguage(code)
    }
    bridge.onLoginMessage = ({ code, duration }) => {
      setLoginMessage((previous) => ({
        code,
        duration,
        seq: (previous?.seq ?? 0) + 1
      }))
    }
    bridge.onRegisterMessage = ({ code, duration }) => {
      setRegisterMessage((previous) => ({
        code,
        duration,
        seq: (previous?.seq ?? 0) + 1
      }))
    }
    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onUpdateRecipeList = null
      bridge.onRecipesPerPage = null
      bridge.onShowPage = null
      bridge.onLoginMessage = null
      bridge.onRegisterMessage = null
    }
  }
    , [bridge])
  return <div style={{
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    //backgroundImage: `url(${backgroundUrl})`,
    backgroundColor: '#00ff004e',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    direction: langConfigs["dir"][language],
    position: 'relative'
  }}>
    {view === 'login'
      ? <LoginForm
          language={language}
          message={loginMessage}
          onSwitch={() => switchView('register')}
          onSubmit={(user) => bridge.fire('onSignIn', JSON.stringify(user))} />
      : <RegisterForm
          language={language}
          message={registerMessage}
          onSwitch={() => switchView('login')}
          onSubmit={(user) => bridge.fire('onSignUp', JSON.stringify(user))} />}
    <div style={{
      position: 'absolute',
      top: '10px',
      left: langConfigs["dir"][language] == 'ltr' ? '10px' : 'auto',
      right: langConfigs["dir"][language] == 'rtl' ? '10px' : 'auto',
    }}>
      <LanguageDropdown language={language} onSelect={(val)=> {
        //setLanguage(val);
        console.log("Language select: ", val);
        bridge.fire('onLanguageChange', val);
      }} />
    </div>
    
  </div>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
