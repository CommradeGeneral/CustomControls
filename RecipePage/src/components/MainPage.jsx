import { EmptyPage } from "./MainPageElements/Empty";
import { SelectedItem } from "./MainPageElements/SelectedItem";
import { NewRecipeForm } from "./MainPageElements/NewRecipeForm";
import { RecipeDetail } from "./MainPageElements/RecipeDetail";
import { CloseButton } from "./MainPageElements/CloseButton";

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
export function MainPage({ language = 'en', recipe = null, loading = true, onDeselect, creating = false, createSession = 0, recipePage = null, recipePageSession = 0, deleteMessage = null, saveMessage = null, onRecipeDelete, onRecipeSave, onSidePage, message = null, materials = null, existingCodes = [], onCreateSubmit, onCreateCancel }) {
    // Each action that claims the pane clears the others where the state is
    // owned - opening a detail page drops the form, and starting a form drops
    // the page - so the order of these checks is not a precedence rule.
    // Reaching here with both set would mean a clear was missed upstream.
    if (recipePage) {
        return (
            <div className="selected-item" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <CloseButton language={language} onClose={onDeselect} />
                <RecipeDetail
                    // Changes on every CreateRecipePage call, so the page is
                    // mounted afresh rather than reused with an edit or a
                    // confirm still open over the new data.
                    key={recipePageSession}
                    recipe={recipePage}
                    language={language}
                    deleteMessage={deleteMessage}
                    saveMessage={saveMessage}
                    materials={materials}
                    onDelete={onRecipeDelete}
                    onSave={onRecipeSave}
                    onSidePage={onSidePage}
                />
            </div>
        )
    }

    if (creating) {
        return (
            <NewRecipeForm
                // Changes each time the form is opened, so React mounts a new
                // one rather than reusing the last with its state intact.
                key={createSession}
                language={language}
                message={message}
                materials={materials}
                existingCodes={existingCodes}
                onSidePage={onSidePage}
                onSubmit={onCreateSubmit}
                onCancel={onCreateCancel}
            />
        )
    }

    return recipe
        ? <SelectedItem recipe={recipe} language={language} loading={loading} onDeselect={onDeselect} />
        : <EmptyPage language={language} />
}
