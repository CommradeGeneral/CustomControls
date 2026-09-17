import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import buildCards from './buildCards'
import PageSelect from './PageSelect'
import './RecipeList.css'

// Example/demo data, shown only while the showTemplate property is true. When
// the container turns it off the same cards are meant to be filled from an
// external query instead, so the list renders empty rather than falling back.
//
// Shape mirrors the recipes table one-to-one: id, plant_id, code, name,
// description, is_active, created_at, updated_at. Text columns are plain
// strings, so the same values render in both languages.
const templateRecipes = [
  { id: 1, plant_id: 1, code: 'RC-0025', name: 'Standard Concrete', description: 'Standard concrete mix recipe', is_active: true, created_at: '2026-01-12T08:15:00Z', updated_at: '2026-08-03T10:42:00Z' },
  { id: 2, plant_id: 1, code: 'RC-0030', name: 'Standard Concrete', description: 'Standard concrete mix recipe', is_active: true, created_at: '2026-01-20T09:05:00Z', updated_at: '2026-09-01T14:20:00Z' },
  { id: 3, plant_id: 2, code: 'RC-0035', name: 'High Strength Concrete', description: 'High strength concrete mix recipe', is_active: true, created_at: '2026-02-02T11:30:00Z', updated_at: '2026-07-18T16:05:00Z' },
  { id: 4, plant_id: 2, code: 'RC-0040', name: 'High Strength Concrete', description: 'High strength concrete mix recipe', is_active: true, created_at: '2026-02-14T13:45:00Z', updated_at: '2026-06-22T09:10:00Z' },
  { id: 5, plant_id: 3, code: 'RC-0020', name: 'Lean Concrete', description: 'Lean concrete mix recipe', is_active: true, created_at: '2026-01-05T07:50:00Z', updated_at: '2026-05-30T11:55:00Z' },
  { id: 6, plant_id: 1, code: 'RC-0031', name: 'Pump Concrete', description: 'Pump concrete mix recipe', is_active: false, created_at: '2026-02-21T15:20:00Z', updated_at: '2026-08-27T08:35:00Z' },
  { id: 7, plant_id: 4, code: 'RC-0045', name: 'High Performance', description: 'High performance concrete mix recipe', is_active: true, created_at: '2026-03-03T10:00:00Z', updated_at: '2026-09-05T12:15:00Z' },
  { id: 8, plant_id: 5, code: 'RC-0050', name: 'Rapid Set Concrete', description: 'Rapid set concrete mix recipe', is_active: true, created_at: '2026-03-17T12:25:00Z', updated_at: '2026-07-09T15:40:00Z' },
  { id: 9, plant_id: 4, code: 'RC-0055', name: 'Decorative Concrete', description: 'Decorative concrete mix recipe', is_active: true, created_at: '2026-03-29T09:35:00Z', updated_at: '2026-06-11T10:05:00Z' },
  { id: 10, plant_id: 2, code: 'RC-0060', name: 'Self-Compacting Concrete', description: 'Self-compacting concrete mix recipe', is_active: true, created_at: '2026-04-08T14:10:00Z', updated_at: '2026-08-19T13:50:00Z' },
  { id: 11, plant_id: 3, code: 'RC-0065', name: 'Fiber Reinforced Concrete', description: 'Fiber reinforced concrete mix recipe', is_active: true, created_at: '2026-04-19T08:55:00Z', updated_at: '2026-09-10T09:25:00Z' },
  { id: 12, plant_id: 1, code: 'RC-0070', name: 'Lightweight Concrete', description: 'Lightweight concrete mix recipe', is_active: false, created_at: '2026-05-02T11:15:00Z', updated_at: '2026-05-28T16:30:00Z' },
  { id: 13, plant_id: 5, code: 'RC-0075', name: 'Waterproof Concrete', description: 'Waterproof concrete mix recipe', is_active: true, created_at: '2026-05-16T13:05:00Z', updated_at: '2026-08-08T11:45:00Z' },
  { id: 14, plant_id: 6, code: 'RC-0080', name: 'Recycled Aggregate Concrete', description: 'Recycled aggregate concrete mix recipe', is_active: true, created_at: '2026-06-01T09:40:00Z', updated_at: '2026-09-12T15:10:00Z' },
  { id: 15, plant_id: 2, code: 'RC-0085', name: 'Cold Weather Concrete', description: 'Cold weather concrete mix recipe', is_active: true, created_at: '2026-06-23T10:20:00Z', updated_at: '2026-07-31T08:20:00Z' },
  { id: 16, plant_id: 4, code: 'RC-0090', name: 'Bridge Deck Concrete', description: 'Bridge deck concrete mix recipe', is_active: true, created_at: '2026-07-07T12:50:00Z', updated_at: '2026-09-13T17:00:00Z' },
  { id: 17, plant_id: 3, code: 'RC-0095', name: 'Pavement Concrete', description: 'Pavement concrete mix recipe', is_active: true, created_at: '2026-07-25T08:30:00Z', updated_at: '2026-08-30T14:05:00Z' },
]

/**
 * Which rows the list actually shows.
 *
 * Supplied rows win whenever CreateCards has delivered any, so the control is
 * useful without waiting for the container to think about showTemplate. The
 * template stands in only while nothing has been supplied and the flag is on;
 * with neither, the list is legitimately empty.
 *
 * Null vs [] carries the distinction: null is "never supplied", while an empty
 * array is a real result and renders no cards rather than falling back to the
 * demo rows.
 */
const rowsToRender = (supplied, showTemplate) =>
  supplied ?? (showTemplate ? templateRecipes : [])

/**
 * The codes currently on screen, for callers that must not offer one again.
 *
 * Exported from here because the fallback above decides which rows exist, and
 * a second copy of that rule elsewhere would drift. Goes through buildCards so
 * a container row's spelling of the column (Code, RecipeCode, ...) resolves the
 * same way it does for the cards themselves.
 */
export const recipeCodesFor = (supplied, showTemplate) =>
  buildCards(rowsToRender(supplied, showTemplate))
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
  },
  ar: {
    recipeList: 'قائمة الوصفات', newRecipe: 'وصفة جديدة', search: 'البحث عن وصفة...',
    itemsPerPage: 'العناصر في الصفحة', recipePages: 'صفحات الوصفات', selectPage: 'اختر صفحة الوصفات',
    previous: 'الصفحة السابقة', next: 'الصفحة التالية',
    created: 'أُنشئت', updated: 'آخر تحديث', active: 'نشطة', inactive: 'غير نشطة',
    noRecipes: 'لا توجد وصفات للعرض',
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

export default function RecipeList({ language = 'en', itemsPerPage = 15, onItemsPerPageChange, showTemplate = true, recipes: recipesProp, onCardSelect, onSelectedRowChange, selectedId, onNewRecipe }) {
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
  // Supplied rows win whenever CreateCards has delivered any, so the control is
  // useful without waiting for the container to think about showTemplate. The
  // template stands in only while nothing has been supplied and the flag is on;
  // with neither, the list is legitimately empty.
  //
  // Null vs [] carries the distinction: null is "never supplied", while an
  // empty array is a real result and renders no cards rather than falling back
  // to the demo rows. Both sources go through the builder, so the cards below
  // see one shape regardless of origin.
  const recipes = buildCards(rowsToRender(recipesProp, showTemplate))
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
          {visibleRecipes.length === 0 && (
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
