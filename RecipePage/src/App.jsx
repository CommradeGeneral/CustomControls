import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import RecipeList from './components/RecipeList'
import './index.css'
import './App.css'

function App() {
  const bridge = window.RecipeBridge
  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  //const [activeItem, setActiveItem] = useState(() => menuKeys[bridge?.selectedItemNumber] || 'main')
  //const text = labels[language]

  useEffect(() => {
    if (!bridge) return undefined
    bridge.onLanguage = (value) => {
      const nextLanguage = typeof value === 'string' && value.toLowerCase() === 'ar' ? 'ar' : 'en'
      setLanguage(nextLanguage)
    }

    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
    }
  }, [bridge])

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

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
