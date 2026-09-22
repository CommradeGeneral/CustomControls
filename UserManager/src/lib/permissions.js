/*
 * What the signed-in Role is allowed to do.
 *
 * The Role property is an integer the container supplies, and the database
 * stores it without interpreting it - see the role column in sql/01_users.sql,
 * which states that TIA decides what each value means. That leaves the meaning
 * to be defined somewhere, and this is the somewhere: one module the whole
 * control agrees with, rather than a bitmask repeated at each place it is
 * checked.
 *
 * ---------------------------------------------------------------------------
 * Role is a bit field, not a rank
 * ---------------------------------------------------------------------------
 *
 * Each permission owns one bit, so they combine freely and a role is read by
 * testing the bit rather than by comparing magnitudes. Role 4 is not "more
 * than" role 3; it is a different set of permissions.
 *
 * That is why nothing here is written as `role >= n`. A threshold test would
 * quietly grant every permission below it, so adding a bit later would widen
 * access that was never granted.
 *
 *   bit 0  (value 1)  may see and manage other users
 *
 * Bits 1 and up are unassigned. A role carrying them is not refused: the
 * container may use them for permissions this build does not know about, and
 * masking them off here would be this control deciding what they mean.
 */

/** Bit 0: the holder may see the Users section. */
export const ROLE_MANAGE_USERS = 1

/**
 * The roles an operator can be given from the Users section.
 *
 * Cumulative rather than exclusive: each carries the bits of the one before
 * it, so a supervisor can do everything a user can and the list reads as
 * widening access down the page.
 *
 *   user        1       bit 0 alone
 *   supervisor  3       bits 0 and 1
 *   admin       65535   every bit in the low 16
 *
 * Admin is 0xFFFF rather than a bit of its own, so it satisfies any permission
 * added later without this list having to be revisited. That is also why it
 * must never be written as an upper bound - a future check for bit 16 would
 * silently exclude the administrators.
 *
 * These are the roles this control can *assign*. They are not the only roles
 * it may *encounter*: the container can store any integer, and hasPermission
 * reads whatever arrives by its bits. A row carrying a value not listed here
 * is a valid role that this UI simply has no name for.
 */
export const ASSIGNABLE_ROLES = [
  { value: 1, key: 'user' },
  { value: 3, key: 'supervisor' },
  { value: 0xFFFF, key: 'admin' },
]

/** The role a new account starts on: the narrowest this control can assign. */
export const DEFAULT_ASSIGNED_ROLE = ASSIGNABLE_ROLES[0].value

/**
 * Whether `role` carries `bit`.
 *
 * Fails closed on anything that is not a non-negative integer. code.js already
 * coerces the property, so a malformed value should not arrive - but this is
 * the function guarding what the operator can see, and it should not depend on
 * something upstream having done its job.
 *
 * Bitwise operators coerce their operands, so `'3' & 1` is 1: without the
 * explicit check a string role would silently grant permissions.
 */
export function hasPermission(role, bit) {
  if (!Number.isInteger(role) || role < 0) return false
  // eslint-disable-next-line no-bitwise
  return (role & bit) !== 0
}

/**
 * Whether this role may see and manage other users.
 *
 * Named rather than left as a bitmask at the call site, so the UI reads as a
 * statement about permission and the bit is defined in one place. Role 0 - the
 * schema's default, and the one it requires to be least privileged - carries
 * no bits and is therefore refused, which is the right way round: a row
 * inserted without an explicit role must not be able to manage users.
 */
export function canManageUsers(role) {
  return hasPermission(role, ROLE_MANAGE_USERS)
}
