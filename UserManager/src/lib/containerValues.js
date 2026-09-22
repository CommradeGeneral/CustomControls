/*
 * Reading values that arrived from the container.
 *
 * A row crosses the WebCC boundary through marshalling and JSON, and comes out
 * with its types flattened: a bit column as "0", a NULL as the string "null",
 * a datetime as any of five shapes. Every one of those reads as content rather
 * than as absence unless it is decoded first.
 *
 * Kept apart from the components that use them because they are pure value
 * handling with no React in them, and because the list and the detail page
 * have to agree: a row that reads as inactive in the list must not read as
 * active on its own page.
 */

/*
 * Milliseconds since the epoch from whatever spelling a timestamp arrives in,
 * or null when it is not a usable time.
 *
 * A datetime column reaches the control in several forms depending on how the
 * container read it: the [seconds, nanoseconds] pair marshalling produces, a
 * bare epoch number, an ISO string, a Date, or - when the row was serialized
 * from a .NET DateTime - the "/Date(1789623389183)/" wrapper, which no Date
 * constructor understands.
 *
 * Bare numbers are ambiguous: the database sends seconds while JS uses
 * milliseconds, and the two differ by a factor of 1000 rather than failing
 * loudly. Values below the threshold are therefore read as seconds, which is
 * unambiguous for any timestamp between 1973 and the year 5138.
 */
const MS_THRESHOLD = 1e11

export function toMilliseconds(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  if (Array.isArray(value)) {
    const seconds = Number(value[0])
    return Number.isFinite(seconds) ? seconds * 1000 : null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.abs(value) < MS_THRESHOLD ? value * 1000 : value
  }

  if (typeof value === 'string') {
    // The .NET serializer's wrapper, whose payload is already milliseconds.
    const dotNet = value.match(/\/Date\((-?\d+)/)
    if (dotNet) return Number(dotNet[1])

    // A bare numeric string is an epoch value, not a date to parse.
    if (/^-?\d+$/.test(value)) {
      const number = Number(value)
      return Math.abs(number) < MS_THRESHOLD ? number * 1000 : number
    }

    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

/**
 * A displayable string, or '' when the value is absent in any of its spellings.
 *
 * Absent is not only null and undefined: a row serialized on the way here can
 * carry a NULL column as the literal text "null", and those read as content
 * rather than as nothing - which is how "null" ends up rendered where a
 * placeholder should have been.
 */
export function toText(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  return (text === '' || text === 'null' || text === 'undefined') ? '' : text
}

/**
 * Coerce to boolean the way buildCards does, so a list row and its detail page
 * cannot disagree about the same record.
 *
 * A bit column does not always arrive as a boolean: serializing the row can
 * carry it as the number 0 or the string "0", and a bare truthiness test reads
 * "0" as true.
 *
 * Absent means true: a source that omits the column is not expressing "false",
 * and defaulting the other way would mark every row inactive.
 */
export function toActive(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return false
    return true
  }
  return Boolean(value)
}

/** `DD-MM-YYYY hh:mm` in UTC, or '' when the value is absent or unparseable. */
export function formatDate(timestamp) {
  const ms = toMilliseconds(timestamp)
  if (ms === null) return ''
  const parsed = new Date(ms)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(parsed.getUTCDate())}-${pad(parsed.getUTCMonth() + 1)}-${parsed.getUTCFullYear()}` +
    ` ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`
}
