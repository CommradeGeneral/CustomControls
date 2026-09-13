import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import RecipeList from './components/RecipeList'
import './index.css'
import './App.css'

function App() {
  const bridge = window.RecipeBridge

  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(() => !bridge?.hasContainer || bridge?.connected === true)

  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  //const [activeItem, setActiveItem] = useState(() => menuKeys[bridge?.selectedItemNumber] || 'main')
  //const text = labels[language]

  useEffect(() => {
    if (!bridge) return undefined
    console.log("Initial Language is: ", bridge?.language);
    // The handshake mutates plain fields, which React cannot observe; this is
    // the notification that lets the gate re-evaluate once it settles.
    bridge.onConnected = () => {
      setReady(!bridge.hasContainer || bridge.connected === true)
    }
    bridge.onLanguage = (value) => {
      const nextLanguage = typeof value === 'string' && value.toLowerCase() === 'ar' ? 'ar' : 'en'
      setLanguage(nextLanguage)
    }

    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onConnected = null
    }
  }, [bridge])

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  // Inside a container, nothing is rendered until the handshake succeeds: the
  // UI would otherwise flash default property values before TIA supplies the
  // real ones. Standalone there is nothing to wait for, so `ready` starts true.
  if (!ready) return null

  return (
    <div className='main-container' dir={language === 'ar' ? 'rtl' : 'ltr'} style={{
      //backgroundColor: 'red',
      width: '100vw',
      display: 'flex',
      gap: '10px'
    }}>
      <div style={{
        width: '400px',
        //backgroundColor: 'blue',
        flexShrink: '0',
        padding: '10px'
      }}>
        <div className="recipe-list" style = {{
          width: '100%',
          height: '100%'
        }}>
          <RecipeList language={language} />
        </div>
      </div>
      <div style={{
        flexGrow: '1'
      }}>
        <div style = {{
          width: '100%',
          height: '100%'
        }}>
          H1
        </div>
      </div>
    </div>
  );
}

//export default App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
