import { useRef } from 'react'
import './Tabs.css'

/**
 * The control's two sections, as a tab strip.
 *
 * Built from ordinary buttons rather than a library: the strip is two items
 * and the whole of its behaviour is the keyboard contract below, which is
 * less code than configuring something general.
 *
 * Controlled, not stateful. Which tab is open decides what the container is
 * told and may later be a property, so the value lives with whoever can answer
 * those questions - this only reports the press.
 *
 * The contract implemented here is the one a screen reader expects of a
 * tablist, and none of it comes for free from <button>:
 *
 *   - Arrow keys move between tabs and wrap at the ends. Left/Right are
 *     swapped under RTL, since "next" follows the reading direction.
 *   - Home and End jump to the first and last.
 *   - Roving tabindex: only the selected tab is tabbable, so Tab enters the
 *     strip once and then leaves it for the panel, rather than stopping on
 *     every tab on the way past.
 *
 * Moving the focus commits the selection, which is the "automatic activation"
 * pattern. It suits two panels that are already rendered; it would be the
 * wrong choice if switching were expensive, since arrowing past a tab would
 * then load it.
 *
 * A tab may carry `disabled` with an optional `disabledHint`. It stays in the
 * strip, greyed and unselectable, so the operator can see the section exists
 * without being able to open it. Because activation follows focus, the arrows
 * skip it rather than landing on it - stopping there would select the very
 * thing being refused.
 */
export function Tabs({ tabs, activeId, onChange, language = 'en', label }) {
  const rtl = language === 'ar'
  const refs = useRef([])

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeId))

  /**
   * Step from `index` in `step` until a selectable tab is found, wrapping.
   *
   * A disabled tab is skipped rather than landed on: this pattern activates
   * on focus, so stopping there would select a section the operator may not
   * open. Bounded by the tab count so a strip with nothing selectable - which
   * cannot happen while one section is ungated - terminates instead of looping.
   */
  const nextEnabled = (index, step) => {
    for (let moved = 0; moved < tabs.length; moved += 1) {
      const at = (index + step * (moved + 1) + tabs.length * (moved + 2)) % tabs.length
      if (!tabs[at].disabled) return at
    }
    return null
  }

  /** Select in the given direction and move focus with it. */
  const move = (index, step) => {
    const at = nextEnabled(index, step)
    if (at === null) return
    onChange?.(tabs[at].id)
    refs.current[at]?.focus()
  }

  /** Select the first or last selectable tab, for Home and End. */
  const moveToEnd = (from) => {
    const at = from === 'first'
      ? tabs.findIndex((tab) => !tab.disabled)
      : tabs.findLastIndex((tab) => !tab.disabled)
    if (at < 0) return
    onChange?.(tabs[at].id)
    refs.current[at]?.focus()
  }

  const handleKeyDown = (event) => {
    // Under RTL the arrow that points at the next tab is the left one, so the
    // step is flipped rather than the tab order - the strip stays in source
    // order and only the direction of travel changes.
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'

    switch (event.key) {
      case forward:
        event.preventDefault()
        move(activeIndex, 1)
        break
      case back:
        event.preventDefault()
        move(activeIndex, -1)
        break
      case 'Home':
        event.preventDefault()
        moveToEnd('first')
        break
      case 'End':
        event.preventDefault()
        moveToEnd('last')
        break
      default:
        break
    }
  }

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId
        return (
          <button
            key={tab.id}
            ref={(node) => { refs.current[index] = node }}
            className={`tabs__tab${selected ? ' tabs__tab--selected' : ''}` +
              (tab.disabled ? ' tabs__tab--disabled' : '')}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            // Names the panel this tab controls, which is what lets a screen
            // reader move between the two. A disabled tab controls nothing,
            // since its panel is never rendered - pointing at an absent id
            // would be a broken reference rather than a useful one.
            aria-controls={tab.disabled ? undefined : `panel-${tab.id}`}
            aria-selected={selected}
            /*
             * aria-disabled rather than the disabled attribute. A disabled
             * button cannot be focused at all, which would hide the tab from a
             * screen reader entirely - and the point of showing it is that the
             * operator can tell the section exists. This way it stays
             * reachable and is announced as unavailable.
             *
             * The click handler is therefore guarded below rather than by the
             * browser, since aria-disabled is a statement and not an
             * enforcement.
             */
            aria-disabled={tab.disabled || undefined}
            title={tab.disabled ? tab.disabledHint : undefined}
            // The roving part: -1 keeps an unselected tab off the tab order
            // without making it unreachable, since the arrows still reach it.
            tabIndex={selected ? 0 : -1}
            onClick={() => { if (!tab.disabled) onChange?.(tab.id) }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {/* The reason, for a screen reader only: the lock icon and the
                greying carry it visually, and neither is announced. */}
            {tab.disabled && tab.disabledHint && (
              <span className="sr-only">{tab.disabledHint}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The panel under the strip.
 *
 * Kept beside Tabs rather than inlined at the call site so the pairing of ids
 * - panel-<id> against the tab's aria-controls - is visible in one place. Get
 * that wrong and nothing looks broken; it just stops being navigable.
 *
 * The inactive panel is unmounted rather than hidden. Each section owns form
 * state that should not survive being navigated away from - a half-typed
 * password least of all.
 */
export function TabPanel({ id, children }) {
  return (
    <div
      className="tabs__panel"
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      // Focusable so that tabbing out of the strip lands in the panel, which
      // is where the next thing to read is. -1 keeps it out of the tab order
      // itself, so it is a target rather than a stop.
      tabIndex={-1}
    >
      {children}
    </div>
  )
}
