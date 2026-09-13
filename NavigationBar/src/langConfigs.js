/**
 * Language table shared by App and LanguageDropdown.
 *
 * Adding a code here is all that is needed to add it to the dropdown; the
 * `names` order is the order shown in the menu.
 */
export const langConfigs = {
  "dir": { "en": "ltr", "ar": "rtl" },
  "names": { "en": "English", "ar": "العربية" },
  "flags": { "en": "US", "ar": "EG" }
}

export const langCodes = Object.keys(langConfigs["names"])
