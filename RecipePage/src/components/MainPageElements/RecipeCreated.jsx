import { CheckCircle2 } from 'lucide-react'
import './RecipeCreated.css'

// Same shape as the other panes' label tables, so every half of the control is
// translated the same way rather than one hardcoding English.
const labels = {
  en: {
    created: {
      title: 'Recipe created',
      hint: 'The recipe was added to the database.',
    },
    saved: {
      title: 'Changes saved',
      hint: 'The recipe was updated in the database.',
    },
  },
  ar: {
    created: {
      title: 'تم إنشاء الوصفة',
      hint: 'تمت إضافة الوصفة إلى قاعدة البيانات.',
    },
    saved: {
      title: 'تم حفظ التغييرات',
      hint: 'تم تحديث الوصفة في قاعدة البيانات.',
    },
  },
}

/**
 * Success pane shown after the container confirms a create.
 *
 * Deliberately built like EmptyPage rather than as a dialog: it replaces the
 * form in the same slot, so the pane keeps one surface and the operator is not
 * left looking at a filled-in form that no longer describes anything pending.
 *
 * Says nothing about timing. The caller owns the exit, so a message that
 * promised to close would be wrong whenever the container sent no timeout.
 *
 * `variant` picks the wording: a create and a saved edit are the same gesture
 * and deserve the same pane, but reporting "created" after an edit would be
 * wrong. Everything else - the badge, the drawn tick, the layout - is shared.
 */
export function RecipeCreated({ language = 'en', variant = 'created' }) {
  const strings = labels[language] ?? labels.en
  const text = strings[variant] ?? strings.created

  return (
    <div className="recipe-created" dir={language === 'ar' ? 'rtl' : 'ltr'} role="status">
      {/* Decorative: the text below already says what the state is. */}
      <CheckCircle2 className="recipe-created__icon" size="1em" strokeWidth={1.5} aria-hidden="true" />
      <p className="recipe-created__title">{text.title}</p>
      <p className="recipe-created__hint">{text.hint}</p>
    </div>
  )
}
