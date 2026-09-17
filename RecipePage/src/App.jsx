import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import RecipeList from './components/RecipeList'
import { recipeCodesFor } from './components/RecipeList'
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
  // Null until the container calls LoadAvailableMaterials; the component table
  // falls back to its built-in list while that is so.
  const [materials, setMaterials] = useState(() => bridge?.materials ?? null)
  // The recipe the detail page is showing, supplied through CreateRecipePage.
  // Null means no page is open; the pane then falls back to the selected row's
  // placeholder or the empty state.
  const [recipePage, setRecipePage] = useState(() => bridge?.recipePage ?? null)
  // Bumped on every CreateRecipePage call, and used as the detail page's key
  // so each call mounts a fresh one. The page holds edit, delete-confirm and
  // success state of its own, none of which the container can see; without
  // this, calling the method again would replace the data while leaving that
  // state on top of it, so a page mid-edit would ignore the new payload.
  const [recipePageSession, setRecipePageSession] = useState(0)
  // The row the list has selected, or null. Held here rather than in RecipeList
  // because the pane beside the list needs it too, and the list is the only
  // thing that can report it.
  const [selectedRow, setSelectedRow] = useState(null)
  // True while the new-recipe form holds the main pane. Lives here because the
  // trigger is in the list and the form is in the pane beside it, so neither
  // can own the flag alone.
  const [creating, setCreating] = useState(false)
  // Bumped every time the form is opened, and used as its key so React mounts
  // a fresh one rather than reusing the last. The form holds five pieces of
  // state seeded only at mount - step, draft, components, the error flag and
  // the container's outcome - and reusing the instance would carry all of them
  // over, so a create that just succeeded would reopen on its success page.
  const [createSession, setCreateSession] = useState(0)
  // Outcome of a create attempt, raised by the container's NewRecipeMessage
  // method. `seq` makes every call distinct, so re-sending the same code
  // restarts the countdown rather than being ignored as equal state.
  //
  // Volatile by design: never written to a property or to storage, so a
  // recreated control comes up with no message.
  const [newRecipeMessage, setNewRecipeMessage] = useState(null)
  // Outcome of a delete, raised by DeleteRecipeMessage. Same seq contract as
  // the create message, so re-sending one code is not ignored as equal state.
  const [deleteMessage, setDeleteMessage] = useState(null)
  // Outcome of an inline edit saved from the detail page. Carried on the same
  // NewRecipeMessage codes as a create, since a container reporting 0 or 1 is
  // saying the same two things.
  const [saveMessage, setSaveMessage] = useState(null)
  // The success panes, which live inside the form and the detail page and so
  // cannot be derived from the state here. Null while neither is showing, in
  // which case the pane is named from the flags above.
  const [sidePageOverride, setSidePageOverride] = useState(null)

  useEffect(() => {
    if (!bridge) return undefined
    // console.log("bridge")
    // console.log("Initial Language is: ", bridge?.language);
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
    // Validated by the LoadAvailableMaterials method the same way rows are, so
    // this is stored as-is and normalized where it is rendered.
    bridge.onMaterials = (value) => {
      setMaterials(Array.isArray(value) ? value : null)
    }
    // Validated by the CreateRecipePage method, so this is stored as-is.
    // Opening a detail page abandons a half-filled form: the two share the
    // pane, and the container has just said which one belongs there.
    bridge.onRecipePage = (value) => {
      setRecipePage(value)
      // A new session even for the same recipe: the call is the container
      // saying what the pane should show, which outranks whatever the operator
      // had open - an unsaved edit, a delete confirm, or a success page.
      setRecipePageSession((session) => session + 1)
      if (value) setCreating(false)
      // The outcome of an earlier save belongs to the page that asked for it.
      // Left standing, it re-applies the moment the next page renders and the
      // success pane reappears over a recipe nobody just saved - the message
      // is a prop, so the page cannot clear it from the inside.
      setSaveMessage(null)
    }
    bridge.onDeleteRecipeMessage = ({ code, duration }) => {
      setDeleteMessage((previous) => ({
        code,
        duration,
        seq: (previous?.seq ?? 0) + 1,
      }))
      // A deleted recipe cannot still be on screen, so the page closes and the
      // card selection goes with it - the list is about to be re-sent without
      // that row, and a selection pointing at it would be stale.
      if (code === 0) {
        setRecipePage(null)
        setSelectedRow(null)
        // The deleted recipe's save outcome, if any, goes with it.
        setSaveMessage(null)
        bridge.fire('onCardSelect', '')
      }
    }
    bridge.onNewRecipeMessage = ({ code, duration }) => {
      const next = (previous) => ({
        code,
        duration,
        seq: (previous?.seq ?? 0) + 1,
      })
      // The same method reports both, because the container answers a create
      // and a save the same way. Whichever pane is open is the one that asked,
      // so only that one is told - otherwise a create's outcome would also
      // close an unrelated edit behind it.
      setNewRecipeMessage(next)
      setSaveMessage(next)
    }
    // Drops whichever pane is showing and tells TIA the selection is gone, so
    // the container is not left holding a row the control no longer displays.
    bridge.onClearSidePage = () => {
      setCreating(false)
      setNewRecipeMessage(null)
      setSaveMessage(null)
      setRecipePage(null)
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
      bridge.onMaterials = null
      bridge.onRecipePage = null
      bridge.onNewRecipeMessage = null
      bridge.onDeleteRecipeMessage = null
      bridge.onClearSidePage = null
      bridge.onConnected = null
    }
  }, [bridge])

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  /*
   * Which pane the operator is looking at, named the way MainPage decides it.
   *
   * The order matches MainPage's own checks, so this cannot disagree with what
   * is on screen: a detail page wins over the form, and the form over the
   * selected row's placeholder.
   *
   * 'created' and 'saved' are not derived here - they live inside the form and
   * the detail page, which report them through onSidePage. Held as state so
   * this one expression still names every pane.
   */
  const sidePage = sidePageOverride
    ?? (recipePage ? 'detail'
      : creating ? 'create'
        : selectedRow ? 'loading'
          : 'empty')

  // Fired on change rather than on every render: the container is being told
  // the pane switched, and a repeat of the same name is not a switch. The ref
  // starts unset, so the first pane is reported once the control settles.
  const lastSidePage = useRef(null)
  useEffect(() => {
    if (!ready) return
    if (lastSidePage.current === sidePage) return
    lastSidePage.current = sidePage
    bridge?.fire('onSidePageChange', sidePage)
  }, [ready, sidePage, bridge])

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
              // Purely outbound: the control opens the form itself, so this
              // only tells the container the operator started one - which is
              // its cue to send the material catalogue for the second step.
              // Fired unconditionally; fire() detects standalone and logs
              // rather than throwing.
              bridge?.fire('onNewRecipeButton')
              setCreating(true)
              // A save's outcome belongs to the detail page, not to the form
              // now taking the pane.
              setSaveMessage(null)
              // A new session, so the form starts at step one with empty
              // fields however the last one ended.
              setCreateSession((session) => session + 1)
              // The previous outcome goes too: it is what the form renders the
              // success page from, and a live one would reopen straight onto
              // it. Clearing the state is what matters - the key alone would
              // not help, since the message is passed in as a prop.
              setNewRecipeMessage(null)
              // The form takes the pane, so an open detail page goes with it -
              // otherwise the pane keeps rendering that recipe and the form
              // never appears.
              setRecipePage(null)
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
              // A different card is a different recipe: an earlier save's
              // outcome must not be reported against it.
              setSaveMessage(null)
              // A card click abandons an open form, discarding its draft.
              setCreating(false)
              // And it drops the detail page, which describes the card that
              // was open before this one. Without this the pane keeps showing
              // the previous recipe until CreateRecipePage answers, so the
              // wait is invisible and the operator reads stale detail as if it
              // were the row they just picked.
              setRecipePage(null)
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
            createSession={createSession}
            recipePage={recipePage}
            recipePageSession={recipePageSession}
            // Reported rather than derived: the success panes are internal to
            // the form and the detail page, so neither is visible from here.
            onSidePage={setSidePageOverride}
            deleteMessage={deleteMessage}
            saveMessage={saveMessage}
            onRecipeSave={(draft) => {
              // Purely outbound, like a create: the container owns persistence,
              // and the edited row only reaches the page again through the next
              // CreateRecipePage push.
              try {
                bridge?.fire('onRecipeUpdate', JSON.stringify(draft))
              } catch (error) {
                console.warn('[RecipePage] onRecipeUpdate: draft is not serializable', error)
              }
            }}
            onRecipeDelete={(id) => {
              // Purely outbound: the container owns persistence, so this only
              // reports the confirmed intent. The page holds its pending state
              // until DeleteRecipeMessage answers.
              bridge?.fire('onRecipeDelete', id)
            }}
            message={newRecipeMessage}
            materials={materials}
            // Mirrors what the list is showing, template rows included: while
            // the template stands in, those are the codes an operator can see,
            // so a form that accepted one would contradict the list beside it.
            existingCodes={recipeCodesFor(recipes, showTemplate)}
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
              setRecipePage(null)
              setSaveMessage(null)
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
