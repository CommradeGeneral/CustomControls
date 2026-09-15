import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import './SearchableSelect.css'

const labels = {
  en: { search: 'Search...', noMatches: 'No matches' },
  ar: { search: 'بحث...', noMatches: 'لا توجد نتائج' },
}

/**
 * Combobox: a select whose open list can be filtered by typing.
 *
 * Built from ordinary elements rather than a native <select> for the same
 * reason PageSelect is - Chromium draws the native popup as an OS widget that
 * ignores page CSS - and because a native select cannot host a filter field at
 * all. The interaction contract follows PageSelect deliberately, so the two
 * dropdowns in this control behave identically.
 *
 * Filtering is a view over the options, never a mutation: `value` stays
 * whatever was committed, so closing without choosing leaves the row alone.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  language = 'en',
  placeholder = '',
  ariaLabel,
  // Optional: what a given option should be matched against, when that is more
  // than the text shown. Lets a material be found by its code without making
  // the code part of the visible label.
  searchText,
}) {
  const text = labels[language] ?? labels.en
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const inputRef = useRef(null)
  const popupRef = useRef(null)
  const optionRefs = useRef([])
  // Viewport coordinates for the fixed popup. Null until measured, so the
  // first paint does not flash in the corner of the screen.
  const [rect, setRect] = useState(null)

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return options
    // Every term must appear somewhere, so "ce 2" finds "Cement 2" - the same
    // all-terms rule the recipe search uses.
    return options.filter((option) => {
      const haystack = String(searchText ? searchText(option) : option).toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }, [options, query, searchText])

  // Opening starts the highlight on the committed value when it is still in
  // the list, so arrowing begins where the operator left off.
  useEffect(() => {
    if (!open) {
      setQuery('')
      // Dropped along with the query: a stale rect would let the next opening
      // paint at the last popup's coordinates for one frame before the layout
      // effect remeasures, which is visible as a jump when the table has
      // scrolled or a different row was opened.
      setRect(null)
      return
    }
    const current = filtered.indexOf(value)
    setActiveIndex(current >= 0 ? current : 0)
  }, [open])

  // Filtering shrinks the list under the highlight; keep it in range rather
  // than pointing past the end.
  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  useLayoutEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  // Focus the filter field on open - the whole point of the control is that
  // typing works immediately - and hand focus back to the button on close.
  useEffect(() => {
    if (open) inputRef.current?.focus()
    else if (document.activeElement === document.body) buttonRef.current?.focus()
  }, [open])

  // Pointerdown rather than click, so a press starting outside dismisses
  // without also activating whatever sits underneath on release. The popup is
  // outside rootRef in the layout sense but not in the DOM, so containment
  // still covers clicks inside it.
  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open])

  /*
   * Measure the button and place the fixed popup against it.
   *
   * Fixed coordinates are viewport coordinates, so the popup does not follow
   * the button on its own: every scroll of any ancestor moves the button while
   * the popup stays put. The scroll listener is capturing, because the table
   * scrolls in an inner container and a bubbling listener on window would
   * never see it.
   */
  useLayoutEffect(() => {
    if (!open) return undefined

    const place = () => {
      const button = buttonRef.current
      if (!button) return
      const box = button.getBoundingClientRect()
      const gap = 2
      const popupHeight = popupRef.current?.offsetHeight ?? 0
      const roomBelow = window.innerHeight - box.bottom
      // Flip above when the list would run off the bottom and there is more
      // room the other way - the same reason PageSelect opens upward.
      const flip = popupHeight > 0 && roomBelow < popupHeight + gap && box.top > roomBelow

      setRect({
        top: flip ? box.top - popupHeight - gap : box.bottom + gap,
        left: box.left,
        width: box.width,
      })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
    // filtered.length is included so the flip is reconsidered as the list
    // shrinks under the filter and the popup's height changes.
  }, [open, filtered.length])

  const commit = (index) => {
    const chosen = filtered[index]
    if (chosen !== undefined) onChange(chosen)
    setOpen(false)
  }

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
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
        setActiveIndex(filtered.length - 1)
        break
      case 'Enter':
        // Enter inside a form would submit it; the combobox claims the key.
        event.preventDefault()
        commit(activeIndex)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  const handleButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div className="sselect" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={'sselect__button' + (value === '' ? ' sselect__button--unset' : '')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="sselect__value">{value === '' ? placeholder : value}</span>
        <ChevronDown className="sselect__caret" size="1em" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={popupRef}
          className="sselect__popup"
          // Viewport coordinates measured from the button. Hidden until the
          // first measurement lands, so it never flashes at the viewport
          // origin before the layout effect runs.
          style={rect
            ? { top: `${rect.top}px`, left: `${rect.left}px`, minWidth: `${rect.width}px` }
            : { visibility: 'hidden' }}
        >
          <div className="sselect__search">
            <Search className="sselect__search-icon" size="1em" aria-hidden="true" />
            <input
              ref={inputRef}
              className="sselect__search-input"
              type="text"
              value={query}
              placeholder={text.search}
              aria-label={text.search}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <OverlayScrollbarsComponent
            className="sselect__scroll"
            defer
            options={{ scrollbars: { theme: 'os-theme-dark', autoHide: 'never' } }}
          >
            <ul className="sselect__list" role="listbox" aria-label={ariaLabel}>
              {filtered.length === 0 && (
                <li className="sselect__empty">{text.noMatches}</li>
              )}
              {filtered.map((option, index) => (
                <li
                  key={option}
                  ref={(node) => { optionRefs.current[index] = node }}
                  role="option"
                  aria-selected={option === value}
                  className={
                    'sselect__option' +
                    (option === value ? ' sselect__option--selected' : '') +
                    (index === activeIndex ? ' sselect__option--active' : '')
                  }
                  // Mousedown, not click: the outside-dismiss handler fires on
                  // pointerdown and would close the popup first.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    commit(index)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {option}
                </li>
              ))}
            </ul>
          </OverlayScrollbarsComponent>
        </div>
      )}
    </div>
  )
}
