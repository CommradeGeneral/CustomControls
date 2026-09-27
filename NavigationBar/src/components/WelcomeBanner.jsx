/**
 * Who is signed in, beside the brand.
 *
 * No container of its own: the bar already has a surface, and a box around
 * two words competes with the controls either side of it. A thin accent rule
 * separates it from the brand instead, which is enough to say the two are
 * different things.
 *
 * The greeting and the name are separate spans rather than one string, so the
 * name can carry the weight: it is the part that changes and the part worth
 * reading, and "Welcome," is only the frame around it. The label is split on
 * its {name} placeholder rather than hardcoding the word, so Arabic - where
 * the greeting sits differently around the name - needs no separate branch.
 *
 * Renders nothing when `username` is empty. That is the signed-out state,
 * which is a real state rather than a missing value, and an empty rule beside
 * the logo would be a mark with nothing to mark.
 */
export default function WelcomeBanner({ username = '', welcome = '' }) {
  if (!username) return null

  const [before, after] = welcome.split('{name}')

  return (
    <div className="welcome-block">
      <p className="welcome-text">
        {before && <span className="welcome-greeting">{before}</span>}
        <span className="welcome-name">{username}</span>
        {after && <span className="welcome-greeting">{after}</span>}
      </p>
    </div>
  )
}
