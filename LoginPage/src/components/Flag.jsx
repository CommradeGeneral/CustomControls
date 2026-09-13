/**
 * Country flags as inline SVG, keyed by language code.
 *
 * Inline rather than emoji: Windows renders regional-indicator pairs (🇺🇸) as
 * plain letter boxes, so emoji flags would show as "US" / "EG" on the target
 * HMI. Inline rather than image files: the control ships as one inlined HTML
 * file, so every asset either becomes a data URI or fails to resolve.
 *
 * Both are simplified to read clearly at 20px — the US canton carries a block
 * of stars rather than fifty, and the Egyptian eagle is a suggestion of one.
 */

const flags = {
  en: (
    // US: 13 stripes with a blue canton.
    <>
      <rect width="20" height="14" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((y) => (
        <rect key={y} y={y} width="20" height="1.08" fill="#b22234" />
      ))}
      <rect width="9" height="7.54" fill="#3c3b6e" />
      {[1.2, 3.5, 5.8].map((cy) =>
        [1.4, 3.4, 5.4, 7.4].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.55" fill="#fff" />
        ))
      )}
    </>
  ),
  ar: (
    // Egypt: red / white / black bands with the Eagle of Saladin.
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="20" height="4.67" fill="#ce1126" />
      <rect y="9.33" width="20" height="4.67" fill="#000" />
      <g fill="#c09300">
        <path d="M10 5.1c1.15 0 2.05.5 2.05 1.5 0 .95-.75 1.5-2.05 2.4-1.3-.9-2.05-1.45-2.05-2.4 0-1 .9-1.5 2.05-1.5z" />
        <rect x="9.3" y="8.5" width="1.4" height="0.5" />
      </g>
    </>
  )
}

export default function Flag({ code, size = 20 }) {
  const shape = flags[code]
  if (!shape) return null

  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 20 14"
      // Decorative: the language name sits next to it in every usage.
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none', borderRadius: '2px' }}>
      {shape}
    </svg>
  )
}
