import { useEffect, useRef } from 'react'

/**
 * Name the pane on screen and tell the container when it changes.
 *
 * The order below matches MainPage's own checks, so the reported name cannot
 * disagree with what is rendered: a detail page wins over the form, and the
 * form over the selected row's placeholder.
 *
 * `override` carries the two names this cannot derive - 'created' and 'saved'
 * belong to success panes inside the form and the detail page, which report
 * them upward rather than being visible from here.
 *
 * Returns the name so a caller can render from the same value it reports.
 */
export function useSidePageReport({
  ready, recipePage, creating, selectedRow, override, fire,
}) {
  const sidePage = override
    ?? (recipePage ? 'detail'
      : creating ? 'create'
        : selectedRow ? 'loading'
          : 'empty')

  // Fired on change rather than on every render: the container is being told
  // the pane switched, and a repeat of the same name is not a switch. The ref
  // starts unset, so the first pane is reported once the control settles.
  const lastReported = useRef(null)
  useEffect(() => {
    if (!ready) return
    if (lastReported.current === sidePage) return
    lastReported.current = sidePage
    fire('onSidePageChange', sidePage)
  }, [ready, sidePage, fire])

  return sidePage
}
