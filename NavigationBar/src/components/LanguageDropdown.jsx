import { useState } from 'react'
import { Flag, languageCodes, languageFlags } from './languageOptions'

export default function LanguageDropdown({ language, labels, onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`language-picker ${open ? 'is-open' : ''}`}>
      <button className="language-switch" type="button" onClick={() => setOpen((wasOpen) => !wasOpen)} aria-expanded={open}>
        <span className="language-current">
          <Flag code={languageFlags[language]} className="language-flag" />
          <span>{labels[language].languageName}</span>
        </span>
      </button>
      {open && (
        <ul className="language-options">
          {languageCodes.map((code) => (
            <li key={code}>
              <button
                className={`language-option ${code === language ? 'is-selected' : ''}`}
                type="button"
                onClick={() => { onSelect(code); setOpen(false) }}
              >
                <Flag code={languageFlags[code]} className="language-flag" />
                <span>{labels[code].languageName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
