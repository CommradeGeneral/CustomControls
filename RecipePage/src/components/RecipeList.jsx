import { useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import buildCards from './buildCards'
import PageSelect from './PageSelect'
import './RecipeList.css'


/**
 * Which rows the list actually shows.
 *
 * Nothing until CreateCards has delivered rows: null is "never supplied" and
 * an empty array is a real result, and both render no cards. The distinction
 * is kept because the two mean different things to a reader, not because they
 * render differently.
 */
const rowsToRender = (supplied) => supplied ?? []

/**
 * The codes currently on screen, for callers that must not offer one again.
 *
 * Goes through buildCards so a container row's spelling of the column (Code,
 * RecipeCode, ...) resolves the same way it does for the cards themselves.
 */
export const recipeCodesFor = (supplied) =>
  buildCards(rowsToRender(supplied))
    .map((row) => row.code)
    .filter(Boolean)

/**
 * Render a timestamp column as `DD-MM-YYYY hh:mm`, or '' when absent.
 *
 * UTC, not local time. The stored timestamps are UTC, and rendering them
 * through the local-time getters silently shifted every card by the viewing
 * machine's offset - on a UTC+2 zone with summer time that showed as +2 or +3
 * depending on the date, so the same row disagreed with the database by a
 * different amount depending on when it was written. Reading UTC back out
 * keeps the card, the database and every client identical regardless of where
 * the panel is opened.
 *
 * The separators are bidi-neutral, so the digit groups would be reordered in
 * an RTL card. Callers render the result with dir="ltr" to pin it.
 */
function formatDate(timestamp) {
  if (!timestamp) return ''
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  const date = `${pad(parsed.getUTCDate())}-${pad(parsed.getUTCMonth() + 1)}-${parsed.getUTCFullYear()}`
  return `${date} ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`
}

const labels = {
  en: {
    recipeList: 'RECIPE LIST', newRecipe: 'New Recipe', search: 'Search recipe...',
    itemsPerPage: 'Items per page', recipePages: 'Recipe pages', selectPage: 'Select recipe page',
    previous: 'Previous page', next: 'Next page',
    created: 'Created', updated: 'Last updated', active: 'Active', inactive: 'Inactive',
    noRecipes: 'No recipes to display',
    loadingCards: 'Loading from the database',
    loadFailed: 'Failed to load from Database',
    reload: 'Reload',
  },
  ar: {
    recipeList: 'قائمة الوصفات', newRecipe: 'وصفة جديدة', search: 'البحث عن وصفة...',
    itemsPerPage: 'العناصر في الصفحة', recipePages: 'صفحات الوصفات', selectPage: 'اختر صفحة الوصفات',
    previous: 'الصفحة السابقة', next: 'الصفحة التالية',
    created: 'أُنشئت', updated: 'آخر تحديث', active: 'نشطة', inactive: 'غير نشطة',
    noRecipes: 'لا توجد وصفات للعرض',
    loadingCards: 'جارٍ التحميل من قاعدة البيانات',
    loadFailed: 'تعذّر التحميل من قاعدة البيانات',
    reload: 'إعادة التحميل',
  },
}

function RecipeCard({ recipe, selected, onSelect, language }) {
  const text = labels[language]
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(selected ? null : recipe.id)
    }
  }
  const created = formatDate(recipe.created_at)
  const updated = formatDate(recipe.updated_at)

  return (
    <article
      className={`recipe-card${selected ? ' recipe-card--selected' : ''}`}
      role="button"
      tabIndex="0"
      aria-pressed={selected}
      onClick={() => onSelect(selected ? null : recipe.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="recipe-card__title-row">
        <strong>{recipe.name}</strong>
        <span className={`recipe-card__status${recipe.is_active ? '' : ' recipe-card__status--inactive'}`}>
          {recipe.is_active ? text.active : text.inactive}
        </span>
      </div>
      <div className="recipe-card__code">{recipe.code}</div>
      <p className="recipe-card__description">{recipe.description}</p>
      <div className="recipe-card__footer">
        <span className="recipe-card__dates">
          {created && (
            <>
              <span className="recipe-card__date-label">{text.created}:</span>
              <span className="recipe-card__date-value" dir="ltr">{created}</span>
            </>
          )}
          {updated && (
            <>
              <span className="recipe-card__date-label">{text.updated}:</span>
              <span className="recipe-card__date-value" dir="ltr">{updated}</span>
            </>
          )}
        </span>
      </div>
    </article>
  )
}

export default function RecipeList({ language = 'en', itemsPerPage = 15, onItemsPerPageChange, recipes: recipesProp, loadingCards = 0, onCardSelect, onSelectedRowChange, selectedId, onNewRecipe, onReloadCards }) {
  const text = labels[language]
  // Owned by the container via the RecipeItemsPerPage property; the input below
  // reports upward rather than setting it here.
  const cardsPerPage = Number.isInteger(itemsPerPage) && itemsPerPage >= 1 ? itemsPerPage : 15
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  // Mirrors the id the parent holds when it supplies one, so a clear issued
  // from elsewhere in the control (the detail pane's deselect) unhighlights the
  // card too. Uncontrolled when the prop is absent, which is how the list
  // behaves on its own.
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const effectiveSelectedId = selectedId === undefined ? selectedRecipe : selectedId
  const [hasScrollableCards, setHasScrollableCards] = useState(false)
  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  // Rows arrive only from the container, through CreateCards.
  const recipes = buildCards(rowsToRender(recipesProp))
  // Matches on title or code only — the description is deliberately not
  // indexed, so a word common to every description cannot match everything.
  //
  // Title matches on word prefixes ("hi str" finds "High Strength Concrete"),
  // while the code matches as a substring: splitting it into words would make
  // the full code "RC-0095" unmatchable, since the query keeps the hyphen the
  // split discards.
  const filteredRecipes = recipes.filter((recipe) => {
    if (!searchTerms.length) return true
    const code = String(recipe.code ?? '').toLowerCase()
    const titleWords = String(recipe.name ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    return searchTerms.every((term) =>
      code.includes(term) || titleWords.some((word) => word.startsWith(term)))
  })
  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / cardsPerPage))
  // A page size pushed down from the container can leave the current page past
  // the end, so clamp for this render rather than showing an empty list.
  const activePage = Math.min(currentPage, totalPages)
  const firstRecipeIndex = (activePage - 1) * cardsPerPage
  const visibleRecipes = filteredRecipes.slice(firstRecipeIndex, firstRecipeIndex + cardsPerPage)
  /**
   * Commit a selection and report it upward.
   *
   * RecipeCard passes the id (or null when toggling itself off), so the row is
   * resolved from it here rather than widening the card's contract. The
   * normalized row is sent, not the original payload entry: the container gets
   * the same field names and coerced types the card displays, instead of the
   * container's own spelling echoed back at it.
   *
   * Deselection reports an empty string, which is the manifest's declared
   * "nothing selected" - a cleared selection has to be distinguishable from no
   * event at all.
   */
  const handleCardSelect = (recipeId) => {
    setSelectedRecipe(recipeId)

    const row = recipeId === null || recipeId === undefined
      ? null
      : recipes.find((recipe) => recipe.id === recipeId) ?? null

    // Two consumers, two shapes. The pane beside the list wants the row object
    // itself; TIA's contract declares a string, so it gets the serialized form.
    // Reported separately rather than making React re-parse what was just
    // stringified.
    onSelectedRowChange?.(row)

    if (!onCardSelect) return
    if (!row) {
      onCardSelect('')
      return
    }
    try {
      onCardSelect(JSON.stringify(row))
    } catch (error) {
      // A row that cannot be serialized must not take the panel down with it.
      console.warn('[RecipePage] onCardSelect: row is not serializable', error)
      onCardSelect('')
    }
  }

  const handleCardsPerPageChange = (event) => {
    const nextCardsPerPage = Number(event.target.value)
    if (!Number.isInteger(nextCardsPerPage) || nextCardsPerPage < 1) return
    onItemsPerPageChange?.(nextCardsPerPage)
    setCurrentPage(1)
  }

  return (
    <section className="recipe-panel" dir={language === 'ar' ? 'rtl' : 'ltr'} aria-label={text.recipeList}>
      <div className="recipe-panel__top">
        <div className="recipe-panel__heading">
          <h2>{text.recipeList}</h2>
          <button className="new-recipe-button" type="button" onClick={onNewRecipe}><Plus size={15} /> {text.newRecipe}</button>
        </div>
        <div className="recipe-tools">
          <label className="recipe-search">
            <span className="sr-only">{text.search}</span>
            <input
              type="search"
              placeholder={text.search}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
            />
            <Search aria-hidden="true" />
          </label>
        </div>
      </div>
      <OverlayScrollbarsComponent
        key={language}
        className={`recipe-cards${hasScrollableCards ? ' recipe-cards--scrollable' : ''}`}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        defer
        options={{ scrollbars: { theme: 'os-theme-dark', autoHide: 'move', autoHideDelay: 500 } }}
        events={{ updated: (instance) => setHasScrollableCards(instance.state().hasOverflow.y) }}
      >
        <div className="recipe-cards__content">
          {/* Replaces the empty state rather than sitting beside it: while the
              query is running or after it failed the list is not empty, it is
              unknown, and saying "no recipes" would be a claim the control
              cannot make. The cards it already has stay put underneath. */}
          {loadingCards === 1 && (
            <div className="recipe-cards__loading" role="status">
              <div className="recipe-cards__spinner" aria-hidden="true" />
              <p className="recipe-cards__loading-text">{text.loadingCards}</p>
            </div>
          )}
          {/* alert rather than status: a failure is worth interrupting a
              screen reader for, where the wait is not. */}
          {loadingCards === 2 && (
            <div className="recipe-cards__loading" role="alert">
              <AlertCircle className="recipe-cards__failed-icon" size="1em" aria-hidden="true" />
              <p className="recipe-cards__failed-text">{text.loadFailed}</p>
              {/* A button styled as a link, not an anchor: there is nowhere to
                  navigate to, and an href="#" would be operable by keyboard
                  only by accident. The control retries nothing itself - it
                  reports the request and waits for the container to run the
                  query again. */}
              <button
                className="recipe-cards__reload"
                type="button"
                onClick={onReloadCards}
              >
                {text.reload}
              </button>
            </div>
          )}
          {loadingCards === 0 && visibleRecipes.length === 0 && (
            <p className="recipe-cards__empty">{text.noRecipes}</p>
          )}
          {visibleRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              language={language}
              selected={effectiveSelectedId === recipe.id}
              onSelect={handleCardSelect}
            />
          ))}
        </div>
      </OverlayScrollbarsComponent>
      <div className="recipe-page-size">
        <label className="cards-per-page-control">
          <span>{text.itemsPerPage}:</span>
          <input
            type="number"
            min="1"
            step="1"
            value={cardsPerPage}
            aria-label={text.itemsPerPage}
            onChange={handleCardsPerPageChange}
          />
        </label>
      </div>
      <div className="recipe-pagination">
        <nav aria-label={text.recipePages}>
          <button
            className="pagination-control"
            type="button"
            aria-label={text.previous}
            disabled={activePage === 1}
            onClick={() => setCurrentPage(activePage - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          <PageSelect
            page={activePage}
            totalPages={totalPages}
            label={text.selectPage}
            onChange={setCurrentPage}
          />
          <button
            className="pagination-control"
            type="button"
            aria-label={text.next}
            disabled={activePage === totalPages}
            onClick={() => setCurrentPage(activePage + 1)}
          >
            <ChevronRight size={20} />
          </button>
        </nav>
      </div>
    </section>
  )
}
