import { X } from 'lucide-react'
import './CloseButton.css'

// Shared by every state of the selected-item pane, so the control sits in the
// same corner whether the detail is still loading or already rendered.
const labels = {
  en: { deselect: 'Cancel selection' },
  ar: { deselect: 'إلغاء التحديد' },
}

/**
 * Corner close button that clears the current selection.
 *
 * Positions itself against the nearest positioned ancestor, so whatever renders
 * it must establish a positioning context - .selected-item does. Placement uses
 * a logical inset, so the corner follows the reading direction rather than
 * needing a second rule for Arabic.
 */
export function CloseButton({ language = 'en', onClose }) {
  if (!onClose) return null
  const text = labels[language] ?? labels.en

  return (
    <button
      className="pane-close"
      type="button"
      onClick={onClose}
      // The label is the button's accessible name rather than visible text: an
      // icon-only control has none otherwise. title gives the same words as a
      // pointer tooltip.
      aria-label={text.deselect}
      title={text.deselect}
    >
      {/* size="1em" hands sizing to the stylesheet, as elsewhere in this pane. */}
      <X size="1em" strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
