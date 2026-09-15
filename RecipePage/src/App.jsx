import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import RecipeList from './components/RecipeList'
import { injectSampleRecipes } from './sampleRecipes'
import './index.css'
import './App.css'
import { MainPage } from './components/MainPage'

// Manual testing aid: call injectSampleRecipes() from the devtools console to
// push a realistic container payload through CreateCards. Attached here because
// a module nothing imports is never loaded, so the console would not see it.
window.injectSampleRecipes = injectSampleRecipes

function App() {
  const bridge = window.RecipeBridge
  

  // Render gate: standalone (no container) shows the UI straight away, and
  // inside a container the UI waits for a successful handshake. Seeded from
  // the bridge because the handshake can settle before React mounts.
  const [ready, setReady] = useState(() => !bridge?.hasContainer || bridge?.connected === true)

  const [language, setLanguage] = useState(bridge?.language === 'ar' ? 'ar' : 'en')
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const seeded = Number(bridge?.recipeItemsPerPage)
    return Number.isInteger(seeded) && seeded >= 1 ? seeded : 5
  })
  const [showTemplate, setShowTemplate] = useState(() => bridge?.showTemplate !== false)
  // Null until the container calls CreateCards; see the bridge field for why
  // that is kept distinct from an empty array.
  const [recipes, setRecipes] = useState(() => bridge?.recipes ?? null)
  // The row the list has selected, or null. Held here rather than in RecipeList
  // because the pane beside the list needs it too, and the list is the only
  // thing that can report it.
  const [selectedRow, setSelectedRow] = useState(null)
  // True while the new-recipe form holds the main pane. Lives here because the
  // trigger is in the list and the form is in the pane beside it, so neither
  // can own the flag alone.
  const [creating, setCreating] = useState(false)
  // Outcome of a create attempt, raised by the container's NewRecipeMessage
  // method. `seq` makes every call distinct, so re-sending the same code
  // restarts the countdown rather than being ignored as equal state.
  //
  // Volatile by design: never written to a property or to storage, so a
  // recreated control comes up with no message.
  const [newRecipeMessage, setNewRecipeMessage] = useState(null)
  //const [activeItem, setActiveItem] = useState(() => menuKeys[bridge?.selectedItemNumber] || 'main')
  //const text = labels[language]

  useEffect(() => {
    if (!bridge) return undefined
    console.log("bridge")
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
    bridge.onRecipeItemsPerPage = (value) => {
      const next = Number(value)
      if (Number.isInteger(next) && next >= 1) setItemsPerPage(next)
    }
    // Read-only from here: the container owns the flag and there is no
    // companion event, so this only ever receives.
    bridge.onShowTemplate = (value) => {
      setShowTemplate(value !== false)
    }
    // Delivered by the CreateCards method, which has already validated that
    // this is an array, so it is stored as-is and normalized at render.
    bridge.onRecipes = (value) => {
      setRecipes(Array.isArray(value) ? value : null)
    }
    bridge.onNewRecipeMessage = ({ code, duration }) => {
      setNewRecipeMessage((previous) => ({
        code,
        duration,
        seq: (previous?.seq ?? 0) + 1,
      }))
    }
    // Drops whichever pane is showing and tells TIA the selection is gone, so
    // the container is not left holding a row the control no longer displays.
    bridge.onClearSidePage = () => {
      setCreating(false)
      setNewRecipeMessage(null)
      setSelectedRow((previous) => {
        if (previous) bridge.fire('onCardSelect', '')
        return null
      })
    }

    const queued = bridge.pending.splice(0, bridge.pending.length)
    queued.forEach(({ kind, value }) => bridge['on' + kind]?.(value))

    return () => {
      bridge.onLanguage = null
      bridge.onRecipeItemsPerPage = null
      bridge.onShowTemplate = null
      bridge.onRecipes = null
      bridge.onNewRecipeMessage = null
      bridge.onClearSidePage = null
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
          <RecipeList
            language={language}
            itemsPerPage={itemsPerPage}
            showTemplate={showTemplate}
            recipes={recipes}
            selectedId={selectedRow?.id ?? null}
            // Each action that claims the main pane clears the other, so the
            // two states are never both set and the pane never has to pick a
            // winner. Whatever the operator did last is what is showing.
            onNewRecipe={() => {
              setCreating(true)
              // Clearing the row also unhighlights the card, since the list
              // follows selectedId - and TIA is told, so the container does not
              // keep a selection the control no longer shows.
              if (selectedRow) {
                setSelectedRow(null)
                bridge?.fire('onCardSelect', '')
              }
            }}
            onSelectedRowChange={(row) => {
              setSelectedRow(row)
              // A card click abandons an open form, discarding its draft.
              setCreating(false)
            }}
            onCardSelect={(serializedRow) => {
              // Purely outbound: the control owns which card is highlighted, so
              // this only notifies TIA. Fired unconditionally - fire() already
              // detects standalone and logs instead of throwing.
              bridge?.fire('onCardSelect', serializedRow)
            }}
            onItemsPerPageChange={(value) => {
              // Same round-trip as Language: inside a container TIA owns the
              // value, so only fire and let the property change come back.
              if (bridge?.connected) {
                bridge.fire('onRecipeItemsPerPageChange', value)
              } else {
                setItemsPerPage(value)
                bridge?.fire('onRecipeItemsPerPageChange', value)
              }
            }}
          />
        </div>
      </div>
      <div style={{
        flexGrow: '1'
      }}>
        <div style = {{
          width: '100%',
          height: '100%'
        }}>
          <MainPage
            language={language}
            recipe={selectedRow}
            creating={creating}
            message={newRecipeMessage}
            onCreateCancel={() => {
              setCreating(false)
              setNewRecipeMessage(null)
            }}
            onCreateSubmit={(draft) => {
              // The container owns persistence, the same way it owns the row
              // list: the draft goes out as a JSON string. Nothing is added
              // locally - the new row arrives, if at all, through the next
              // CreateCards push.
              //
              // The form deliberately stays open afterwards. Closing it was
              // hiding the only place an operator could see what was sent, and
              // there is no round-trip yet to confirm the container accepted
              // it; only Cancel and the corner close button end the flow.
              try {
                bridge?.fire('onRecipeCreate', JSON.stringify(draft))
              } catch (error) {
                console.warn('[RecipePage] onRecipeCreate: draft is not serializable', error)
              }
            }}
            onDeselect={() => {
              // Clears both halves of the selection: the row the pane renders
              // and, through selectedId below, the card the list highlights.
              // TIA is told too, with the same empty string a card toggle
              // sends - otherwise the container would keep the stale row.
              setSelectedRow(null)
              bridge?.fire('onCardSelect', '')
            }}
          />
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
