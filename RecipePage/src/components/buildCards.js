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
 * Coerce to boolean, treating the string and numeric spellings a container may
 * send as truthy/falsy rather than letting 'false' come through as true.
 *
 * Absent means active: a source that omits the column is not expressing
 * "inactive", and defaulting the other way would grey out every card.
 */
function toActive(value) {
  if (value === undefined) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return false
    return true
  }
  return Boolean(value)
}

/** Text fields render directly, so anything non-string becomes '' not 'undefined'. */
function toText(value) {
  if (value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

/**
 * Milliseconds since the epoch, or null when the number is not a usable time.
 *
 * Bare numbers are ambiguous: the database sends seconds, while JS dates are
 * milliseconds, and the two differ by a factor of 1000 rather than failing
 * loudly - a seconds value read as milliseconds silently lands in 1970. Values
 * below the threshold are therefore treated as seconds, which is unambiguous
 * for any timestamp between 1973 and the year 5138.
 */
const MS_THRESHOLD = 1e11

function epochToMs(value) {
  if (!Number.isFinite(value)) return null
  return Math.abs(value) < MS_THRESHOLD ? value * 1000 : value
}

/**
 * Timestamps are passed through as-is when they are a string or Date, since
 * formatDate already parses and rejects. Anything else is dropped to '' so the
 * card omits the date row rather than printing an unparseable value.
 *
 * The [seconds, nanoseconds] tuple is what the container actually sends for a
 * timestamp column. Only the first element is used: formatDate renders to the
 * minute, so the sub-second half cannot change the output, and adding it would
 * risk a rounding error at no benefit.
 */
function toTimestamp(value) {
  if (typeof value === 'string') return value
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()

  if (Array.isArray(value)) {
    const ms = epochToMs(Number(value[0]))
    return ms === null ? '' : new Date(ms).toISOString()
  }
  if (typeof value === 'number') {
    const ms = epochToMs(value)
    return ms === null ? '' : new Date(ms).toISOString()
  }
  // A numeric string that reached here is an epoch value, not an ISO date:
  // the string branch above already claimed anything Date can parse.
  return ''
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
