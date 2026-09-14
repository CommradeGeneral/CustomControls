/**
 * Country flags, keyed by language code.
 *
 * The shapes come from react-world-flags rather than being drawn here, which
 * is what NavigationBar and RecipePage already use. The library bundles its
 * SVGs as inline markup, so they survive viteSingleFile into the one inlined
 * HTML file the control ships as — verified in the built artifacts.
 *
 * Still not emoji: Windows renders regional-indicator pairs as plain letter
 * boxes, so emoji flags would show as "US" / "EG" on the target HMI.
 */
import FlagModule from 'react-world-flags'

const WorldFlag = FlagModule.default || FlagModule

const languageFlags = { en: 'US', ar: 'EG' }

/**
 * `size` is the rendered height; width follows each flag's own ratio.
 *
 * The bundled SVGs do not share one (US is 19:10, Egypt 3:2), so forcing both
 * into a fixed width/height box would stretch or crop at least one. Pinning
 * height keeps the menu rows on a common baseline instead.
 */
export default function Flag({ code, size = 14 }) {
  const country = languageFlags[code]
  if (!country) return null

  return (
    <WorldFlag
      code={country}
      height={size}
      // Decorative: the language name sits next to it in every usage.
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        flex: 'none',
        width: 'auto',
        height: `${size}px`,
        borderRadius: '2px',
        objectFit: 'contain',
      }}
    />
  )
}
