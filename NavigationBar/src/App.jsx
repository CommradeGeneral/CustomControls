import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import LanguageDropdown from './components/LanguageDropdown'
import NavigationBrand from './components/NavigationBrand'
import WelcomeBanner from './components/WelcomeBanner'
import NavigationMenu from './components/NavigationMenu'
import SignOutButton from './components/SignOutButton'
import { labels } from './components/navigationLabels'

const menuKeys = ['main', 'recipes', 'users', 'settings']

function App() {
  const bridge = window.NavBridge
  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(
    () => !bridge?.hasContainer || bridge?.connected === true)
  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  const [activeItem, setActiveItem] = useState(() => menuKeys[bridge?.selectedItemNumber] || 'main')
  // Who the container says is signed in. code.js normalizes it before
  // dispatching, so this is seeded from the bridge as-is rather than
  // re-coercing here - one place decides what a malformed value means.
  const [username, setUsername] = useState(() => bridge?.usernameReal ?? '')
  const text = labels[language]

  useEffect(() => {
    if (!bridge) return undefined

    // The handshake mutates plain fields, which React cannot observe; this is
    // the notification that lets the gate re-evaluate once it settles.
    bridge.onConnected = () => {
      setReady(!bridge.hasContainer || bridge.connected === true)
    }
    bridge.onLanguage = (value) => {
      const nextLanguage = typeof value === 'string' && value.toLowerCase() === 'ar' ? 'ar' : 'en'
      setLanguage(nextLanguage)
    }
    // Already coerced by code.js. The fallback is for the malformed dispatch
    // that should never arrive, and it falls the safe way: no name, no
    // greeting.
    bridge.onUsernameReal = (value) => {
      setUsername(typeof value === 'string' ? value : '')
    }
    bridge.onSelectedItemNumber = (value) => {
      const itemNumber = Number(value)
      if (Number.isInteger(itemNumber) && menuKeys[itemNumber]) setActiveItem(menuKeys[itemNumber])
    }

    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onSelectedItemNumber = null
      bridge.onUsernameReal = null
      bridge.onConnected = null
    }
  }, [bridge])

  // Inside a container, nothing is rendered until the handshake succeeds: the
  // UI would otherwise flash default property values before TIA supplies the
  // real ones. Standalone there is nothing to wait for, so `ready` starts true.
  if (!ready) return null

  return (
    <aside className="navigation-bar" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <NavigationBrand label={text.brand} />
      <WelcomeBanner username={username} welcome={text.welcome} />
      <NavigationMenu
        label={text.menu}
        labels={text}
        activeItem={activeItem}
        onSelect={(itemKey, itemNumber) => {

          if (bridge?.connected) {
            bridge?.fire('onPressingIcon', itemNumber)
          } else {
            setActiveItem(itemKey)
          }

        }}
      />

      <div className="bar-footer">
        <LanguageDropdown
          language={language}
          labels={labels}
          onSelect={(nextLanguage) => {
            if (bridge?.connected) {
              bridge?.fire('onLanguageChange', nextLanguage)
            } else {
              setLanguage(nextLanguage)
              bridge?.fire('onLanguageChange', nextLanguage)
            }
          }}
        />
        <SignOutButton label={text.signOut} onLoginOut={() => bridge?.fire('onLoginOut')} />
      </div>
    </aside>
  )
}

export default App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
