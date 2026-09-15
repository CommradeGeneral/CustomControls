import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'

/**
 * Page picker replacing a native <select>.
 *
 * A native select's dropdown is drawn by the OS, not the page: Chromium on
 * Windows ignores font-size on <option> entirely, so the popup rendered at the
 * document's 22px root size while the closed control was clamped to its 36px
 * box. The two could not be reconciled in CSS, so the listbox is built from
 * ordinary elements the page actually controls - which also lets the overlay
 * scrollbar match the card list instead of an OS scrollbar.
 *
 * Implements the listbox keyboard contract the native element provided for
 * free: type-ahead is the one affordance deliberately left out, since the
 * options are page numbers and the list is reachable by arrows and Home/End.
 */
export default function PageSelect({ page, totalPages, label, onChange }) {
  const [open, setOpen] = useState(false)
  // Which option the keyboard is on while open. Kept separate from the
  // committed page so Escape can abandon a move without changing the page.
  const [activeIndex, setActiveIndex] = useState(page - 1)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const optionRefs = useRef([])

  // Reopening should start from the current page, not wherever the last
  // session left off.
  useEffect(() => {
    if (!open) setActiveIndex(page - 1)
  }, [open, page])

  // A page changed from outside (search reset, container push) must not leave
  // the highlight pointing at a page that no longer exists.
  useEffect(() => {
    setActiveIndex((index) => Math.min(Math.max(index, 0), Math.max(totalPages - 1, 0)))
  }, [totalPages])

  // Scroll the active option into view as the keyboard moves. Layout effect so
  // it lands before paint and the list never appears to jump.
  useLayoutEffect(() => {
    if (!open) return
    const node = optionRefs.current[activeIndex]
    if (node) node.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  // Move focus into the list when it opens so the arrow keys have a target,
  // and return it to the button on close - otherwise focus would fall to the
  // document body and tabbing would restart from the top of the panel.
  useEffect(() => {
    if (open) listRef.current?.focus()
    else if (document.activeElement === document.body) buttonRef.current?.focus()
  }, [open])

  // Dismiss on an outside press. Pointerdown rather than click, so a press
  // that starts outside closes the list without also activating whatever was
  // underneath on release.
  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open])

  const commit = (index) => {
    const next = index + 1
    if (next >= 1 && next <= totalPages) onChange(next)
    setOpen(false)
  }

  const handleButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const handleListKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, totalPages - 1))
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
        setActiveIndex(totalPages - 1)
        break
      case 'PageDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 10, totalPages - 1))
        break
      case 'PageUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 10, 0))
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

  const listboxId = 'page-select-listbox'

  return (
    <div className="page-select" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="pagination-control page-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="page-select__value">{page}/{totalPages}</span>
        <span className="page-select__caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="page-select__popup">
          <OverlayScrollbarsComponent
            className="page-select__scroll"
            defer
            options={{ scrollbars: { theme: 'os-theme-dark', autoHide: 'never' } }}
          >
            <ul
              ref={listRef}
              className="page-select__list"
              role="listbox"
              id={listboxId}
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`page-select-option-${activeIndex}`}
              onKeyDown={handleListKeyDown}
            >
              {Array.from({ length: totalPages }, (_, index) => {
                const value = index + 1
                const isSelected = value === page
                const isActive = index === activeIndex
                return (
                  <li
                    key={value}
                    id={`page-select-option-${index}`}
                    ref={(node) => { optionRefs.current[index] = node }}
                    role="option"
                    aria-selected={isSelected}
                    className={
                      'page-select__option' +
                      (isSelected ? ' page-select__option--selected' : '') +
                      (isActive ? ' page-select__option--active' : '')
                    }
                    // Mousedown rather than click: the pointerdown dismiss
                    // handler above would otherwise close the popup before a
                    // click could land on the option.
                    onMouseDown={(event) => {
                      event.preventDefault()
                      commit(index)
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {value}/{totalPages}
                  </li>
                )
              })}
            </ul>
          </OverlayScrollbarsComponent>
        </div>
      )}
    </div>
  )
}
