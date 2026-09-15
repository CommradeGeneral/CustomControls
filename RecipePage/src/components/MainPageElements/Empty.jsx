import { ClipboardList } from 'lucide-react'
import './Empty.css'

// Same shape as the recipe panel's label table, so both halves of the control
// are translated the same way rather than one hardcoding English.
const labels = {
  en: {
    title: 'No recipe selected',
    hint: 'Select a recipe from the list to see its details here.',
  },
  ar: {
    title: 'لم يتم اختيار وصفة',
    hint: 'اختر وصفة من القائمة لعرض تفاصيلها هنا.',
  },
}

export function EmptyPage({ language = 'en' }) {
  const text = labels[language] ?? labels.en

  return (
    <div className="empty-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Decorative: the text below already says what the state is. */}
      {/* size="1em" hands sizing to the stylesheet; a numeric size would be
          fixed px and would not scale with the root. */}
      <ClipboardList className="empty-page__icon" size="1em" strokeWidth={1.5} aria-hidden="true" />
      <p className="empty-page__title">{text.title}</p>
      <p className="empty-page__hint">{text.hint}</p>
    </div>
  )
}
