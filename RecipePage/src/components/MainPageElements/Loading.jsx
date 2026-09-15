import './Loading.css'

// Same shape as Empty.jsx's table, so both states of the pane are translated
// the same way rather than one hardcoding English.
//
// Two tiers to match the empty state's title/hint pair: the requested label is
// the title, and the second line explains the wait rather than leaving the
// pane's lower half empty where the other state has text.
const labels = {
  en: {
    title: 'Loading from the database',
    hint: 'Fetching the selected recipe.',
  },
  ar: {
    title: 'جارٍ التحميل من قاعدة البيانات',
    hint: 'يتم جلب الوصفة المحددة.',
  },
}

/**
 * Loading state for the selected-item pane.
 *
 * Carries no close button of its own: SelectedItem owns that, so the control
 * stays in the same corner when this is swapped for the loaded detail.
 */
export function LoadingPage({ language = 'en' }) {
  const text = labels[language] ?? labels.en

  return (
    <div
      className="loading-page"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      // Announced as a live region so a screen reader reports the wait rather
      // than falling silent: aria-busy marks the pane itself as in progress,
      // and role="status" reads the label when it appears.
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Decorative: the label below already states what is happening. */}
      <div className="loading-page__spinner" aria-hidden="true" />
      <p className="loading-page__title">{text.title}</p>
      <p className="loading-page__hint">{text.hint}</p>
    </div>
  )
}
