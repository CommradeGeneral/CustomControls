/*
 * What the container's message codes mean to the operator.
 *
 * Three tables, one per method the Users section listens to, kept together
 * and apart from the components that render them: they are the contract
 * restated in the operator's words, and reading them beside each other is how
 * their codes are kept from drifting apart.
 *
 * Every entry carries both languages, so a missing translation is visible
 * here rather than at the point of use.
 */

/**
 * Outcomes the container can raise through the AddUserMessage method.
 * Any other number shows nothing, which is how a message is withdrawn.
 *
 * `closes` marks the one outcome the row can be dismissed on: the account
 * exists, so the draft has nothing left to describe. A failure keeps the row
 * so it can be corrected, except that the password fields are cleared with it
 * - retyping a password is a small cost against leaving a plaintext one in a
 * field on a plant floor.
 *
 * `field` points the operator at the box to fix where the verdict identifies
 * one.
 */
export const ADD_OUTCOMES = {
  0: { ok: true, closes: true, en: 'Account created.', ar: 'تم إنشاء الحساب.' },
  1: {
    ok: false,
    field: 'username',
    en: 'That username is already taken.',
    ar: 'اسم المستخدم مستخدم بالفعل.',
  },
  2: {
    ok: false,
    field: 'password',
    en: 'The password was rejected. Choose a different one.',
    ar: 'تم رفض كلمة المرور. اختر كلمة أخرى.',
  },
  3: {
    ok: false,
    en: 'The database could not be reached. Try again.',
    ar: 'تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.',
  },
  // Kept apart from 3 because it means something different to the operator:
  // a database error is worth retrying, a refused request is not.
  4: {
    ok: false,
    field: 'role',
    en: 'That role cannot be assigned.',
    ar: 'لا يمكن تعيين هذا الدور.',
  },
}

/**
 * What the list shows in place of rows when LoadUsers reports a failure.
 *
 * Keyed by the same numbers the method declares. Anything not listed is an
 * unspecified failure, which is what 3 already says, so an unknown code
 * reports something true rather than nothing at all.
 */
export const LOAD_FAILURES = {
  1: {
    en: { title: 'Could not load the accounts', hint: 'The database could not be reached.' },
    ar: { title: 'تعذّر تحميل الحسابات', hint: 'تعذّر الوصول إلى قاعدة البيانات.' },
  },
  2: {
    en: { title: 'Not permitted', hint: 'Your role does not allow listing accounts.' },
    ar: { title: 'غير مسموح', hint: 'دورك لا يسمح بعرض الحسابات.' },
  },
  3: {
    en: { title: 'Could not load the accounts', hint: 'The request did not complete.' },
    ar: { title: 'تعذّر تحميل الحسابات', hint: 'لم يكتمل الطلب.' },
  },
}

/**
 * Outcomes the container can raise through the EditUserMessage method.
 * Any other number shows nothing, which is how a message is withdrawn.
 */
export const EDIT_OUTCOMES = {
  0: { ok: true, closes: true, en: 'Saved.', ar: 'تم الحفظ.' },
  // Not a code: the same 0 the container sends, reworded for the row that
  // asked for a delete rather than a save.
  deleted: { ok: true, closes: true, en: 'Account deleted.', ar: 'تم حذف الحساب.' },
  1: {
    ok: false,
    en: 'That account no longer exists.',
    ar: 'لم يعد هذا الحساب موجودًا.',
  },
  2: {
    ok: false,
    en: 'The password was rejected. Choose a different one.',
    ar: 'تم رفض كلمة المرور. اختر كلمة أخرى.',
  },
  3: {
    ok: false,
    en: 'The database could not be reached. Try again.',
    ar: 'تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.',
  },
  4: {
    ok: false,
    en: 'That change is not permitted.',
    ar: 'هذا التغيير غير مسموح به.',
  },
  5: {
    ok: false,
    en: 'That account owns others and cannot be deleted.',
    ar: 'هذا الحساب يملك حسابات أخرى ولا يمكن حذفه.',
  },
}
