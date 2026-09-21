import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import RecipeList, { recipeCodesFor } from './components/RecipeList'
import { MainPage } from './components/MainPage'
import { useBridge } from './hooks/useBridge'
import { useMainPane } from './hooks/useMainPane'
import { useSidePageReport } from './hooks/useSidePageReport'
import './index.css'
import './App.css'

/**
 * The control: a recipe list beside a pane showing one of its states.
 *
 * Holds no state of its own. Everything the container owns lives in useBridge,
 * everything about which pane is showing in useMainPane, and this composes the
 * two - so what remains here is the wiring between them and the layout.
 */
function App() {
  const bridge = useBridge()
  const {
    ready, language, itemsPerPage, setItemsPerPage,
    recipes, materials, recipePage, setRecipePage, recipePageSession,
    loadingCards, setLoadingCards,
    newRecipeMessage, setNewRecipeMessage,
    deleteMessage, saveMessage, setSaveMessage,
    clearPaneSignal, fire,
  } = bridge

  const pane = useMainPane({
    clearPaneSignal, setRecipePage, setNewRecipeMessage, setSaveMessage, fire,
  })

  useSidePageReport({
    ready,
    recipePage,
    creating: pane.creating,
    selectedRow: pane.selectedRow,
    override: pane.sidePageOverride,
    fire,
  })

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
    <div className="main-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="main-container__list">
        <RecipeList
          language={language}
          itemsPerPage={itemsPerPage}
          recipes={recipes}
          loadingCards={loadingCards}
          selectedId={pane.selectedRow?.id ?? null}
          onNewRecipe={pane.startCreating}
          onSelectedRowChange={pane.selectRow}
          // Purely outbound: the control owns which card is highlighted, so
          // this only notifies the container.
          onCardSelect={(serializedRow) => fire('onCardSelect', serializedRow)}
          onReloadCards={() => {
            // The control cannot re-run the query, so this only reports that a
            // retry was asked for. The placeholder is raised here rather than
            // waiting for the container, so the press is acknowledged at once -
            // its own LoadingCardsMessage(1) then agrees with what is showing.
            setLoadingCards(1)
            fire('onReloadCards')
          }}
          onItemsPerPageChange={(value) => {
            // A round trip: inside a container the property is the container's
            // to set, so this only reports the change and waits for it to come
            // back. Standalone there is nobody to answer, so it is applied
            // locally as well.
            if (!window.RecipeBridge?.connected) setItemsPerPage(value)
            fire('onRecipeItemsPerPageChange', value)
          }}
        />
      </div>

      <div className="main-container__pane">
        <MainPage
          language={language}
          recipe={pane.selectedRow}
          creating={pane.creating}
          createSession={pane.createSession}
          recipePage={recipePage}
          recipePageSession={recipePageSession}
          materials={materials}
          message={newRecipeMessage}
          deleteMessage={deleteMessage}
          saveMessage={saveMessage}
          existingCodes={recipeCodesFor(recipes)}
          // Reported rather than derived: the success panes are internal to
          // the form and the detail page, so neither is visible from here.
          onSidePage={pane.setSidePageOverride}
          onDeselect={pane.deselect}
          onCreateCancel={pane.cancelCreating}
          // Purely outbound: the container owns persistence, so a new row
          // reaches the list only through the next CreateCards push.
          onCreateSubmit={(draft) => fireDraft('onRecipeCreate', draft, fire)}
          onRecipeSave={(draft) => fireDraft('onRecipeUpdate', draft, fire)}
          // The page holds its pending state until DeleteRecipeMessage answers.
          onRecipeDelete={(id) => fire('onRecipeDelete', id)}
        />
      </div>
    </div>
  )
}

/**
 * Send a draft as a JSON string.
 *
 * Guarded because a draft is assembled from operator input: a value that
 * cannot be serialized would otherwise throw out of the event handler and
 * leave the form looking as though nothing happened.
 */
function fireDraft(event, draft, fire) {
  try {
    fire(event, JSON.stringify(draft))
  } catch (error) {
    console.warn(`[RecipePage] ${event}: draft is not serializable`, error)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
