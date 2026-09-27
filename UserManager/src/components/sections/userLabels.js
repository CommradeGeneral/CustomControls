/*
 * Every string the Users section renders, in both languages.
 *
 * One table rather than strings scattered through the markup, so a missing
 * translation is visible at a glance and the two languages can be compared
 * line by line. The section and both of its rows read from the same resolved
 * object, which is what stops them wording the same idea differently.
 */

// Same shape as every other label table in the control, so both halves are
// translated the same way rather than one hardcoding English.
export const labels = {
  en: {
    heading: 'Users',
    hint: 'The accounts this user manages.',
    addUser: 'Add user',
    username: 'Username',
    usernamePlaceholder: 'Login name',
    displayName: 'Display name',
    displayNamePlaceholder: 'Optional',
    password: 'Password',
    passwordPlaceholder: 'Initial password',
    confirm: 'Confirm',
    confirmPlaceholder: 'Repeat password',
    role: 'Role',
    // Keyed by the role's own name rather than its number, so the table does
    // not have to be re-read when a value changes.
    roles: { user: 'User', supervisor: 'Supervisor', admin: 'Administrator' },
    save: 'Create user',
    saving: 'Creating…',
    savingEdit: 'Saving…',
    saveChanges: 'Save changes',
    cancel: 'Discard',
    required: 'A username and a password are required.',
    mismatch: 'The passwords do not match.',
    notWired: 'Not connected yet: this row reports nothing to the container.',
    loading: 'Loading accounts',
    loadingHint: 'Asking the container for the accounts this user manages.',
    retry: 'Try again',
    edit: 'Edit',
    resetPassword: 'Reset password',
    newPassword: 'New password',
    resetHint: 'Sets a new password without needing the old one.',
    deleteUser: 'Delete account',
    confirmDelete: 'Confirm delete?',
    confirmDeleteTree: 'Delete {n} accounts?',
    active: 'Active',
    inactive: 'Inactive',
    empty: 'No users to display',
    emptyHint: 'The container has not supplied any accounts yet.',
  },
  ar: {
    heading: 'المستخدمون',
    hint: 'الحسابات التي يديرها هذا المستخدم.',
    addUser: 'إضافة مستخدم',
    username: 'اسم المستخدم',
    usernamePlaceholder: 'اسم الدخول',
    displayName: 'الاسم المعروض',
    displayNamePlaceholder: 'اختياري',
    password: 'كلمة المرور',
    passwordPlaceholder: 'كلمة المرور الأولية',
    confirm: 'التأكيد',
    confirmPlaceholder: 'أعد إدخال كلمة المرور',
    role: 'الدور',
    roles: { user: 'مستخدم', supervisor: 'مشرف', admin: 'مسؤول' },
    save: 'إنشاء المستخدم',
    saving: 'جارٍ الإنشاء…',
    savingEdit: 'جارٍ الحفظ…',
    saveChanges: 'حفظ التغييرات',
    cancel: 'تجاهل',
    required: 'اسم المستخدم وكلمة المرور مطلوبان.',
    mismatch: 'كلمتا المرور غير متطابقتين.',
    notWired: 'غير متصل بعد: هذا الصف لا يُبلغ الحاوي بشيء.',
    loading: 'جارٍ تحميل الحسابات',
    loadingHint: 'يتم طلب الحسابات التي يديرها هذا المستخدم من الحاوي.',
    retry: 'أعد المحاولة',
    edit: 'تعديل',
    resetPassword: 'إعادة تعيين كلمة المرور',
    newPassword: 'كلمة المرور الجديدة',
    resetHint: 'تعيين كلمة مرور جديدة دون الحاجة إلى القديمة.',
    deleteUser: 'حذف الحساب',
    confirmDelete: 'تأكيد الحذف؟',
    confirmDeleteTree: 'حذف {n} حسابات؟',
    active: 'نشط',
    inactive: 'غير نشط',
    empty: 'لا يوجد مستخدمون للعرض',
    emptyHint: 'لم يرسل الحاوي أي حسابات بعد.',
  },
}

/**
 * The owned-users section.
 *
 * Layout only: the header, the Add user button and the empty state are real,
 * and the list that belongs underneath is not wired.
 *
 * Add user opens a draft row inline in the list rather than a panel over it,
 * so the accounts stay visible while one is being added and the operator does
 * not leave the tab they chose. The row's own fields are live; its confirm is
 * disabled until an `onAddUser` is supplied, so it cannot submit into nothing.
 *
 * Creating a user needs a contract this manifest does not declare - an event
 * carrying the draft, and a method reporting the outcome - and it needs more
 * care than the recipe equivalent did: a new account's password crosses the
 * same boundary as the change-password form's, so the container must hash it.
 *
 */
