import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './Select.css'

/**
 * A listbox built from ordinary elements, replacing a native <select>.
 *
 * A native select's popup is drawn by the OS, not the page: Chromium on
 * Windows resolves <option> text against the document root rather than the
 * control, so at this control's 22px root the list came up half again larger
 * than the closed button, and nothing in CSS could reconcile the two. The
 * colours, the row height and the padding are equally out of reach.
 *
 * Built from divs, all of that is simply the page's own CSS.
 *
 * What a native select gave for free and is therefore implemented here:
 *
 *   - Enter, Space, ArrowUp and ArrowDown open the list from the button.
 *   - While open, the arrows move a highlight, Home and End jump to the ends,
 *     Enter and Space commit, and Escape abandons without changing the value.
 *   - Focus moves into the list on open and returns to the button on close,
 *     so the tab order is not lost.
 *   - A press outside dismisses it.
 *
 * Type-ahead is the one affordance deliberately left out: these lists are a
 * handful of named options, all reachable in a keypress or two.
 *
 * `value` is compared with ===, so options carrying numbers stay numbers -
 * the caller never has to parse a string back into the type it started with,
 * which is what a native select forces.
 */
export function Select({ value, options, onChange, label, disabled = false, language = 'en' }) {
  const [open, setOpen] = useState(false)
  // Which option the keyboard is on while open. Separate from the committed
  // value so Escape can abandon a move without changing anything.
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const optionRefs = useRef([])

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  // Reopening starts from the current value, not wherever the last session
  // left the highlight.
  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  // Keep the highlight on a real option if the list itself changes.
  useEffect(() => {
    setActiveIndex((index) => Math.min(Math.max(index, 0), Math.max(options.length - 1, 0)))
  }, [options.length])

  // Scroll the active option into view as the keyboard moves. Layout effect so
  // it lands before paint and the list never appears to jump.
  useLayoutEffect(() => {
    if (!open) return
    const node = optionRefs.current[activeIndex]
    // Guarded rather than called outright: scrolling an option into view is a
    // convenience, and an environment without it must not take the whole
    // control down on open.
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeIndex])

  // Move focus into the list when it opens so the arrows have a target, and
  // back to the button on close - otherwise focus falls to the document body
  // and tabbing restarts from the top of the form.
  useEffect(() => {
    if (open) listRef.current?.focus()
    else if (document.activeElement === document.body) buttonRef.current?.focus()
  }, [open])

  // Dismiss on an outside press. Pointerdown rather than click, so a press
  // that starts outside closes the list without also activating whatever was
  // underneath it on release.
  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open])

  const commit = (index) => {
    const option = options[index]
    if (option) onChange?.(option.value)
    setOpen(false)
  }

  const handleButtonKeyDown = (event) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp'
      || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const handleListKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        // Let focus leave, but do not leave an orphaned popup behind it.
        setOpen(false)
        break
      default:
        break
    }
  }

  const listboxId = `select-listbox-${label?.replace(/\s+/g, '-').toLowerCase() ?? 'x'}`

  return (
    <div className="select" ref={rootRef} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <button
        ref={buttonRef}
        type="button"
        className={`select__button${open ? ' select__button--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="select__value">{selected?.label ?? ''}</span>
        <ChevronDown className="select__caret" size="1em" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          className="select__list"
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listboxId}-option-${activeIndex}`}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <li
                key={String(option.value)}
                id={`${listboxId}-option-${index}`}
                ref={(node) => { optionRefs.current[index] = node }}
                role="option"
                aria-selected={isSelected}
                className={
                  'select__option'
                  + (isSelected ? ' select__option--selected' : '')
                  + (isActive ? ' select__option--active' : '')
                }
                // Mousedown rather than click: the pointerdown dismiss handler
                // above would otherwise close the list before a click could
                // land on the option.
                onMouseDown={(event) => {
                  event.preventDefault()
                  commit(index)
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
