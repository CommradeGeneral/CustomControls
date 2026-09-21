import { toActive, toMilliseconds, toText } from '../lib/containerValues'

// Normalizes an arbitrary array of rows into the card shape RecipeCard renders.
//
// The rows come from two places that do not agree on field names: the template
// data mirrors the recipes table exactly, while a container-supplied query can
// name the same columns differently (RecipeName, Code, Active, ...). Rather
// than teach RecipeCard about every spelling, everything is funnelled through
// here first, so the card only ever sees one shape.

// Candidate source keys per card field, tried in order. The table's own column
// name comes first so template data costs a single lookup.
const FIELD_ALIASES = {
  id: ['id', 'Id', 'ID', 'recipe_id', 'recipeId', 'RecipeId'],
  code: ['code', 'Code', 'recipe_code', 'recipeCode', 'RecipeCode'],
  name: ['name', 'Name', 'recipe_name', 'recipeName', 'RecipeName', 'title', 'Title'],
  description: ['description', 'Description', 'desc', 'Desc'],
  is_active: ['is_active', 'isActive', 'IsActive', 'active', 'Active'],
  created_at: ['created_at', 'createdAt', 'CreatedAt', 'created', 'Created'],
  updated_at: ['updated_at', 'updatedAt', 'UpdatedAt', 'updated', 'Updated', 'modified_at', 'modifiedAt'],
}

/** First alias present on the row with a non-null value, else undefined. */
function pick(row, aliases) {
  for (const key of aliases) {
    const value = row[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

/**
 * A timestamp the card can render, or '' when the value is not a usable time.
 *
 * Returned as an ISO string rather than a number because RecipeCard formats it
 * later. toMilliseconds does the decoding, so the [seconds, nanoseconds] tuple,
 * bare epoch numbers, the .NET /Date(...)/ wrapper and ISO strings are all
 * understood the same way the detail page understands them.
 */
function toTimestamp(value) {
  const ms = toMilliseconds(value)
  return ms === null ? '' : new Date(ms).toISOString()
}

/**
 * Build normalized card objects from an array of rows.
 *
 * Non-array input and non-object entries yield no card rather than throwing:
 * the array can arrive from the container, and a malformed payload should
 * render an empty list, not break the panel.
 *
 * `id` is what React keys on and what selection is tracked by, so a row
 * without a usable one falls back to its index. That is stable for a given
 * array, which is all the key and the selected-id comparison require.
 */
export default function buildCards(rows) {
  if (!Array.isArray(rows)) return []

  return rows.reduce((cards, row, index) => {
    if (!row || typeof row !== 'object') return cards

    const rawId = pick(row, FIELD_ALIASES.id)
    cards.push({
      id: rawId === undefined ? `row-${index}` : rawId,
      code: toText(pick(row, FIELD_ALIASES.code)),
      name: toText(pick(row, FIELD_ALIASES.name)),
      description: toText(pick(row, FIELD_ALIASES.description)),
      is_active: toActive(pick(row, FIELD_ALIASES.is_active)),
      created_at: toTimestamp(pick(row, FIELD_ALIASES.created_at)),
      updated_at: toTimestamp(pick(row, FIELD_ALIASES.updated_at)),
    })
    return cards
  }, [])
}
