import { LoadingPage } from "./Loading";
import { CloseButton } from "./CloseButton";
import "./SelectedItem.css";

/**
 * Detail view for the selected recipe.
 *
 * Owns the close button rather than leaving it to each inner state: the card
 * must be deselectable whether the detail is still loading or already loaded,
 * and one button here keeps it in the same corner across the swap instead of
 * appearing to move when the state changes. That is also why this element is
 * the positioning context - .selected-item carries position: relative, and the
 * button is absolutely placed against it.
 *
 * `loading` defaults to true and nothing clears it yet: the per-recipe query
 * does not exist, so the pane holds the loading state until a future
 * implementation reports that the row's detail has arrived.
 *
 * The check precedes the body deliberately: a refetch for an already-selected
 * recipe should show the wait, not stale detail beneath it.
 */
export function SelectedItem({ recipe, language = 'en', loading = true, onDeselect }) {
    return (
        <div className="selected-item" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <CloseButton language={language} onClose={onDeselect} />
            {loading
                ? <LoadingPage language={language} />
                : (
                    <div className="selected-item__body">
                        <p className="selected-item__title">A dummy Selected</p>
                    </div>
                )}
        </div>
    )
}
