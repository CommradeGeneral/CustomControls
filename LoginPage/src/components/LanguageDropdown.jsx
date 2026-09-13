/**
 * Custom language picker: a trigger button with the current language and a
 * menu of the available ones directly beneath it.
 *
 * Purely presentational — the selected code is owned by the caller, so the
 * container can drive the language through the `Language` property while the
 * operator can still switch it here.
 *
 * Styling lives in LanguageDropdown.css rather than inline: the trigger and
 * the menu have to agree on one width, and hover states cannot be expressed
 * as inline styles at all.
 */
import { useState } from 'react'
import { langConfigs, langCodes } from '../langConfigs'
import Flag from './Flag'
import './LanguageDropdown.css'

export default function LanguageDropdown({ language, onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="lang-dropdown">
      <button
        type="button"
        className={open ? 'lang-trigger is-open' : 'lang-trigger'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}>
        <Flag code={language} />
        <span className="lang-label">
          {langConfigs["names"][language]}
        </span>
        <span className={open ? 'lang-caret is-open' : 'lang-caret'} aria-hidden="true">
          ▼
        </span>
      </button>
      {open && (
        <ul className="lang-menu" role="listbox">
          {langCodes.map((code) => (
            <li key={code} role="option" aria-selected={code === language}>
              <button
                type="button"
                className={code === language ? 'lang-option is-selected' : 'lang-option'}
                onClick={() => { onSelect(code); setOpen(false); }}>
                <Flag code={code} />
                {langConfigs["names"][code]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
