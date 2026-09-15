import { EmptyPage } from "./MainPageElements/Empty";
import { SelectedItem } from "./MainPageElements/SelectedItem";
import { NewRecipeForm } from "./MainPageElements/NewRecipeForm";

// Passes language straight through: the pane has no state of its own, but
// everything it holds is translated, so the prop belongs here rather than
// being reached for again once a real detail view replaces the placeholder.
//
// `recipe` is the selected row, or null when nothing is selected - the same
// distinction the list draws, so "no selection" and "a row that vanished from
// the data" both land on the empty state rather than a half-rendered detail.
//
// `creating` and `recipe` are mutually exclusive by construction: whichever
// action the operator took last clears the other where the state is owned, so
// the order of the checks below is not a precedence rule and changing it would
// not change what renders. Both being set would mean a bug upstream, not a
// case to arbitrate here.
export function MainPage({ language = 'en', recipe = null, loading = true, onDeselect, creating = false, message = null, onCreateSubmit, onCreateCancel }) {
    if (creating) {
        return (
            <NewRecipeForm
                language={language}
                message={message}
                onSubmit={onCreateSubmit}
                onCancel={onCreateCancel}
            />
        )
    }

    return recipe
        ? <SelectedItem recipe={recipe} language={language} loading={loading} onDeselect={onDeselect} />
        : <EmptyPage language={language} />
}
