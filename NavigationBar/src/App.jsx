import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import LanguageDropdown from './components/LanguageDropdown'
import NavigationBrand from './components/NavigationBrand'
import NavigationMenu from './components/NavigationMenu'
import SignOutButton from './components/SignOutButton'
import { labels } from './components/navigationLabels'

const menuKeys = ['main', 'recipes', 'users', 'settings']

function App() {
  const bridge = window.RecipeBridge
  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  const [activeItem, setActiveItem] = useState(() => menuKeys[bridge?.selectedItemNumber] || 'main')
  const text = labels[language]

  useEffect(() => {
    if (!bridge) return undefined

    bridge.onLanguage = (value) => {
      const nextLanguage = typeof value === 'string' && value.toLowerCase() === 'ar' ? 'ar' : 'en'
      setLanguage(nextLanguage)
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
    }
  }, [bridge])

  return (
    <aside className="navigation-bar" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <NavigationBrand label={text.brand} />
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
