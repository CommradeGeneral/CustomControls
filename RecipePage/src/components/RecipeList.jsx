import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import './RecipeList.css'

const recipes = [
  { code: 'RC-0025', name: { en: 'Standard Concrete', ar: 'خرسانة عادية' }, title: { en: 'Standard Concrete', ar: 'خرسانة عادية' }, description: { en: 'Standard concrete mix recipe', ar: 'وصفة خلطة خرسانة عادية' }, version: 'v2', company: 'ABC Concrete Company', active: true },
  { code: 'RC-0030', name: { en: 'Standard Concrete', ar: 'خرسانة عادية' }, title: { en: 'Standard Concrete', ar: 'خرسانة عادية' }, description: { en: 'Standard concrete mix recipe', ar: 'وصفة خلطة خرسانة عادية' }, version: 'v3', company: 'ABC Concrete Company', active: true, selected: true },
  { code: 'RC-0035', name: { en: 'High Strength Concrete', ar: 'خرسانة عالية المقاومة' }, title: { en: 'High Strength Concrete', ar: 'خرسانة عالية المقاومة' }, description: { en: 'High strength concrete mix recipe', ar: 'وصفة خلطة خرسانة عالية المقاومة' }, version: 'v1', company: 'XYZ Construction', active: true },
  { code: 'RC-0040', name: { en: 'High Strength Concrete', ar: 'خرسانة عالية المقاومة' }, title: { en: 'High Strength Concrete', ar: 'خرسانة عالية المقاومة' }, description: { en: 'High strength concrete mix recipe', ar: 'وصفة خلطة خرسانة عالية المقاومة' }, version: 'v1', company: 'XYZ Construction', active: true },
  { code: 'RC-0020', name: { en: 'Lean Concrete', ar: 'خرسانة هزيلة' }, title: { en: 'Lean Concrete', ar: 'خرسانة هزيلة' }, description: { en: 'Lean concrete mix recipe', ar: 'وصفة خلطة خرسانة هزيلة' }, version: 'v2', company: 'BuildWell Ltd.', active: true },
  { code: 'RC-0031', name: { en: 'Pump Concrete', ar: 'خرسانة مضخوخة' }, title: { en: 'Pump Concrete', ar: 'خرسانة مضخوخة' }, description: { en: 'Pump concrete mix recipe', ar: 'وصفة خلطة خرسانة مضخوخة' }, version: 'v1', company: 'ABC Concrete Company', active: false },
  { code: 'RC-0045', name: { en: 'High Performance', ar: 'خرسانة عالية الأداء' }, title: { en: 'High Performance', ar: 'خرسانة عالية الأداء' }, description: { en: 'High performance concrete mix recipe', ar: 'وصفة خلطة خرسانة عالية الأداء' }, version: 'v1', company: 'Premier Construction', active: true },
  { code: 'RC-0050', name: { en: 'Rapid Set Concrete', ar: 'خرسانة سريعة التصلب' }, title: { en: 'Rapid Set Concrete', ar: 'خرسانة سريعة التصلب' }, description: { en: 'Rapid set concrete mix recipe', ar: 'وصفة خلطة خرسانة سريعة التصلب' }, version: 'v2', company: 'Metro Materials', active: true },
  { code: 'RC-0055', name: { en: 'Decorative Concrete', ar: 'خرسانة زخرفية' }, title: { en: 'Decorative Concrete', ar: 'خرسانة زخرفية' }, description: { en: 'Decorative concrete mix recipe', ar: 'وصفة خلطة خرسانة زخرفية' }, version: 'v1', company: 'Premier Construction', active: true },
  { code: 'RC-0060', name: { en: 'Self-Compacting Concrete', ar: 'خرسانة ذاتية الدمك' }, title: { en: 'Self-Compacting Concrete', ar: 'خرسانة ذاتية الدمك' }, description: { en: 'Self-compacting concrete mix recipe', ar: 'وصفة خلطة خرسانة ذاتية الدمك' }, version: 'v3', company: 'XYZ Construction', active: true },
  { code: 'RC-0065', name: { en: 'Fiber Reinforced Concrete', ar: 'خرسانة مسلحة بالألياف' }, title: { en: 'Fiber Reinforced Concrete', ar: 'خرسانة مسلحة بالألياف' }, description: { en: 'Fiber reinforced concrete mix recipe', ar: 'وصفة خلطة خرسانة مسلحة بالألياف' }, version: 'v2', company: 'BuildWell Ltd.', active: true },
  { code: 'RC-0070', name: { en: 'Lightweight Concrete', ar: 'خرسانة خفيفة الوزن' }, title: { en: 'Lightweight Concrete', ar: 'خرسانة خفيفة الوزن' }, description: { en: 'Lightweight concrete mix recipe', ar: 'وصفة خلطة خرسانة خفيفة الوزن' }, version: 'v1', company: 'ABC Concrete Company', active: false },
  { code: 'RC-0075', name: { en: 'Waterproof Concrete', ar: 'خرسانة مقاومة للماء' }, title: { en: 'Waterproof Concrete', ar: 'خرسانة مقاومة للماء' }, description: { en: 'Waterproof concrete mix recipe', ar: 'وصفة خلطة خرسانة مقاومة للماء' }, version: 'v2', company: 'Metro Materials', active: true },
  { code: 'RC-0080', name: { en: 'Recycled Aggregate Concrete', ar: 'خرسانة بركام معاد التدوير' }, title: { en: 'Recycled Aggregate Concrete', ar: 'خرسانة بركام معاد التدوير' }, description: { en: 'Recycled aggregate concrete mix recipe', ar: 'وصفة خلطة خرسانة بركام معاد التدوير' }, version: 'v1', company: 'GreenBuild Ltd.', active: true },
  { code: 'RC-0085', name: { en: 'Cold Weather Concrete', ar: 'خرسانة للطقس البارد' }, title: { en: 'Cold Weather Concrete', ar: 'خرسانة للطقس البارد' }, description: { en: 'Cold weather concrete mix recipe', ar: 'وصفة خلطة خرسانة للطقس البارد' }, version: 'v2', company: 'XYZ Construction', active: true },
  { code: 'RC-0090', name: { en: 'Bridge Deck Concrete', ar: 'خرسانة بلاطات الجسور' }, title: { en: 'Bridge Deck Concrete', ar: 'خرسانة بلاطات الجسور' }, description: { en: 'Bridge deck concrete mix recipe', ar: 'وصفة خلطة خرسانة بلاطات الجسور' }, version: 'v4', company: 'Premier Construction', active: true },
  { code: 'RC-0095', name: { en: 'Pavement Concrete', ar: 'خرسانة الرصف' }, title: { en: 'Pavement Concrete', ar: 'خرسانة الرصف' }, description: { en: 'Pavement concrete mix recipe', ar: 'وصفة خلطة خرسانة الرصف' }, version: 'v1', company: 'BuildWell Ltd.', active: true },
]

const companies = {
  'ABC Concrete Company': 'شركة ABC للخرسانة',
  'XYZ Construction': 'شركة XYZ للإنشاءات',
  'BuildWell Ltd.': 'شركة BuildWell المحدودة',
  'Premier Construction': 'شركة Premier للإنشاءات',
  'Metro Materials': 'شركة Metro للمواد',
  'GreenBuild Ltd.': 'شركة GreenBuild المحدودة',
}

const labels = {
  en: {
    recipeList: 'RECIPE LIST', newRecipe: 'New Recipe', search: 'Search recipe...',
    itemsPerPage: 'Items per page', recipePages: 'Recipe pages', selectPage: 'Select recipe page',
    previous: 'Previous page', next: 'Next page', active: 'Active', inactive: 'Inactive',
  },
  ar: {
    recipeList: 'قائمة الوصفات', newRecipe: 'وصفة جديدة', search: 'البحث عن وصفة...',
    itemsPerPage: 'العناصر في الصفحة', recipePages: 'صفحات الوصفات', selectPage: 'اختر صفحة الوصفات',
    previous: 'الصفحة السابقة', next: 'الصفحة التالية', active: 'نشطة', inactive: 'غير نشطة',
  },
}

function RecipeCard({ recipe, selected, onSelect, language }) {
  const text = labels[language]
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(selected ? null : recipe.code)
    }
  }

  return (
    <article
      className={`recipe-card${selected ? ' recipe-card--selected' : ''}`}
      role="button"
      tabIndex="0"
      aria-pressed={selected}
      onClick={() => onSelect(selected ? null : recipe.code)}
      onKeyDown={handleKeyDown}
    >
      <div className="recipe-card__title-row">
        <strong>{recipe.code.replace('RC-', 'C')} - {recipe.title[language]}</strong>
        <span className="recipe-card__version">{recipe.version}</span>
      </div>
      <div className="recipe-card__code">{recipe.code}</div>
      <p className="recipe-card__description">{recipe.description[language]}</p>
      <div className="recipe-card__footer">
        <span>{language === 'ar' ? companies[recipe.company] : recipe.company}</span>
        <span className="recipe-card__status-group">
          <span className="recipe-card__version-badge">{recipe.version}</span>
          <span className={`recipe-card__status${recipe.active ? '' : ' recipe-card__status--inactive'}`}>
            {recipe.active ? text.active : text.inactive}
          </span>
        </span>
      </div>
    </article>
  )
}

export default function RecipeList({ language = 'en' }) {
  const text = labels[language]
  const [cardsPerPage, setCardsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState('RC-0030')
  const [hasScrollableCards, setHasScrollableCards] = useState(false)
  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredRecipes = recipes.filter((recipe) => {
    if (!searchTerms.length) return true
    const searchableText = `${recipe.code} ${recipe.name.en} ${recipe.name.ar} ${recipe.company} ${recipe.title.en} ${recipe.title.ar} ${recipe.description.en} ${recipe.description.ar}`.toLowerCase()
    const words = searchableText.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    return searchTerms.every((term) => words.some((word) => word.startsWith(term)))
  })
  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / cardsPerPage))
  const firstRecipeIndex = (currentPage - 1) * cardsPerPage
  const visibleRecipes = filteredRecipes.slice(firstRecipeIndex, firstRecipeIndex + cardsPerPage)
  const handleCardsPerPageChange = (event) => {
    const nextCardsPerPage = Number(event.target.value)
    if (!Number.isInteger(nextCardsPerPage) || nextCardsPerPage < 1) return
    setCardsPerPage(nextCardsPerPage)
    setCurrentPage(1)
  }

  return (
    <section className="recipe-panel" dir={language === 'ar' ? 'rtl' : 'ltr'} aria-label={text.recipeList}>
      <div className="recipe-panel__top">
        <div className="recipe-panel__heading">
          <h2>{text.recipeList}</h2>
          <button className="new-recipe-button" type="button"><Plus size={15} /> {text.newRecipe}</button>
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
          {visibleRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.code}
              recipe={recipe}
              language={language}
              selected={selectedRecipe === recipe.code}
              onSelect={setSelectedRecipe}
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
            aria-label={text.cardsPerPage}
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
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => page - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          <label>
            <span className="sr-only">{text.selectPage}</span>
            <select
              className="pagination-control pagination-page-select"
              value={currentPage}
              aria-label={text.selectPage}
              onChange={(event) => setCurrentPage(Number(event.target.value))}
            >
              {Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1
                return <option key={page} value={page}>{page}/{totalPages}</option>
              })}
            </select>
          </label>
          <button
            className="pagination-control"
            type="button"
            aria-label={text.next}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((page) => page + 1)}
          >
            <ChevronRight size={20} />
          </button>
        </nav>
      </div>
    </section>
  )
}
