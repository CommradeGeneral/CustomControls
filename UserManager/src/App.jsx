import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { KeyRound, Lock, Users } from 'lucide-react'
import { Tabs, TabPanel } from './components/Tabs'
import { ChangePassword } from './components/sections/ChangePassword'
import { OwnedUsers } from './components/sections/OwnedUsers'
import { useBridge } from './hooks/useBridge'
import { canManageUsers } from './lib/permissions'
import './index.css'
import './App.css'

// The two sections, in the order they appear in the strip. A table rather than
// markup so the tab and its panel cannot drift apart: both are generated from
// the same row, and the id is what pairs them for a screen reader.
//
// Labels are held here rather than inside the sections because the strip has
// to render them without mounting the section they belong to.
const SECTIONS = [
  {
    id: 'password',
    icon: <KeyRound size="1em" aria-hidden="true" />,
    label: { en: 'Change password', ar: 'تغيير كلمة المرور' },
  },
  {
    id: 'users',
    icon: <Users size="1em" aria-hidden="true" />,
    label: { en: 'Users', ar: 'المستخدمون' },
    // Hidden unless the signed-in Role carries the bit. A section with no
    // `permitted` is available to everyone, so the common case needs no entry
    // and a new gated section cannot be added by forgetting one.
    permitted: canManageUsers,
  },
]

const STRIP_LABEL = { en: 'Sections', ar: 'الأقسام' }

// Why a tab is unavailable. Shown as its tooltip and read out to a screen
// reader, because the greying alone says "no" without saying why.
const LOCKED_HINT = {
  en: 'Your role does not allow managing users.',
  ar: 'دورك لا يسمح بإدارة المستخدمين.',
}

/**
 * The control: two sections behind a tab strip.
 *
 *   Change password   the signed-in account's own password
 *   Users             the accounts that account manages, if its Role may
 *
 * The Users section is gated on bit 0 of Role - see lib/permissions.js. The
 * tab stays in the strip either way, locked and unselectable when the role
 * lacks the bit: the strip then has the same shape on every account, and an
 * operator who cannot open a section can at least tell it exists and why.
 * Losing the bit while the section is open closes the section rather than only
 * locking the way back to it.
 *
 * This is presentation, not security. The control is the wrong place to
 * enforce a permission: the rows it would hide have already crossed the
 * boundary, and anyone who can reach the devtools can reach them. The
 * container is what must refuse to send data the role may not have, and must
 * re-check any request the control sends it.
 *
 * The change-password section is wired: it fires onChangePassword and waits
 * for ChangePasswordMessage. The Users section is not - it shows a placeholder
 * where components/ItemList will go, and its own file says what wiring it up
 * involves.
 *
 * The sections are alternatives rather than halves of one view, which is what
 * the tab strip expresses and why only the open one is mounted.
 *
 * Holds one piece of state - which tab is open - and should not grow more:
 * everything the container owns belongs in useBridge.
 *
 * ---------------------------------------------------------------------------
 * What the contract currently carries
 * ---------------------------------------------------------------------------
 *
 * Two methods, one event and three properties, so useBridge returns:
 *
 *   ready, language, username, role,
 *   passwordMessage, setPasswordMessage, fire
 *
 * Print is deliberately invisible here: it logs to the console and the status
 * line without touching React, which is what makes it a test of the
 * container -> control direction on its own.
 *
 * Username names the account in the change-password section's header, so an
 * operator at a shared panel can see whose password is about to change. Role
 * decides which sections exist, through lib/permissions.js.
 *
 * Both are normalized in code.js, so reading them is enough and nothing has to
 * be re-checked at the point of use. Role fails closed at 0, which the schema
 * requires to be the least privileged role, so gate on `role >= N` and never
 * on a role being absent.
 *
 * Adding anything to the contract means four places, and missing one is the
 * usual bug: manifest.json declares it, code.js implements it and dispatches
 * it, useBridge holds it as state and attaches an `on*` handler for it, and
 * this component reads it. An event needs the first two and `fire`.
 *
 * ---------------------------------------------------------------------------
 * Components already written
 * ---------------------------------------------------------------------------
 *
 * Unused and out of the bundle, kept as the pieces a fuller UI starts from:
 *
 *   ItemList            components/ItemList      a searchable, paged list
 *   MainPage            components/MainPage      a pane and its four states
 *   useMainPane         hooks/useMainPane        which pane is showing
 *   useSidePageReport   hooks/useSidePageReport  naming it for the container
 *
 * ItemList is what belongs in the Users section - it is domain-neutral, so an
 * app_user row needs an alias entry in buildCards.js rather than a new
 * component. All four expect the fuller contract this manifest no longer
 * declares - rows, detail pages, create and delete outcomes - so wiring one
 * back in means restoring the methods it reads as well as the component.
 */
function App() {
  const {
    ready, language, username, role,
    passwordMessage, setPasswordMessage,
    addUserMessage, setAddUserMessage,
    users, usersStatus, setUsersStatus,
    fire,
  } = useBridge()

  // Which section the operator has asked for. Not necessarily the one on
  // screen: a section they may no longer open is overridden below rather than
  // written back here, so regaining the permission returns them to it instead
  // of silently forgetting what they had chosen.
  //
  // Local because nothing outside the control has an opinion about it yet: if
  // the container should be able to open a section, or be told which one is
  // showing, this becomes a property and an event rather than growing a second
  // source of truth beside it.
  const [requested, setRequested] = useState(SECTIONS[0].id)

  // Which sections this role may open. Recomputed on every render rather than
  // cached, so a Role change takes effect the moment it arrives - a permission
  // held in state could be stale at exactly the moment it matters.
  const allowed = (item) => !item.permitted || item.permitted(role)

  // What is actually shown. A section the role may not open is overridden
  // here, which closes it as well as locking its tab: locking the tab alone
  // would leave an open Users section mounted and readable after the role that
  // opened it was revoked.
  //
  // Falls back to the first section the role may open. That can never be
  // undefined as long as one section is ungated, and Change password is -
  // every account can change its own password.
  const requestedSection = SECTIONS.find((item) => item.id === requested)
  const section = requestedSection && allowed(requestedSection)
    ? requested
    : SECTIONS.find(allowed)?.id

  /*
   * Ask the container for the accounts each time the Users section opens.
   *
   * The control queries nothing itself, so this is the only thing that can
   * put rows in that section - without it the list stays empty however long
   * the operator waits.
   *
   * Keyed on the section actually showing rather than on the tab press, so it
   * covers every way the section can open: a click, and equally a Role change
   * that makes it reachable while the operator is already looking at it. The
   * effect only runs when `section` changes, so re-renders within the section
   * do not re-ask.
   *
   * Gated on `ready` for the same reason the UI is: inside a container the
   * properties are not trustworthy until the handshake settles, and asking on
   * behalf of an empty username would be asking the wrong question.
   */
  //
  // The identity is read through a ref rather than depended on: naming
  // username and role in the dependency list would re-ask every time either
  // changed, which is a different event from the one this is - the container
  // is being told the section was opened, not that a property moved.
  // Named `owner` rather than `username`, because that is what the manifest
  // declares and what the container reads: the question being asked is whose
  // accounts to send, not who is asking.
  const identity = useRef({ owner: username, role })
  useEffect(() => {
    identity.current = { owner: username, role }
  }, [username, role])

  const askForUsers = () => {
    // Back to the loading state before asking, so the section shows the wait
    // rather than leaving the previous failure on screen until an answer
    // arrives - and so a retry after a failure is visibly a retry.
    setUsersStatus(-1)
    fireRequest('onPressUserTab', { ...identity.current }, fire)
  }

  // Held in a ref so the effect below need not depend on it: the function is
  // recreated every render, and naming it in the dependency list would re-ask
  // the container on each one.
  const ask = useRef(askForUsers)
  useEffect(() => {
    ask.current = askForUsers
  })

  useEffect(() => {
    if (!ready || section !== 'users') return
    ask.current()
  }, [ready, section])

  // The document, not the control: an RTL language has to reach the root for
  // scrollbars and text selection to follow it, which a nested dir cannot do.
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  // Inside a container, nothing is rendered until the handshake succeeds: the
  // UI would otherwise flash default property values before TIA supplies the
  // real ones. Standalone there is nothing to wait for, so `ready` starts true.
  if (!ready) return null

  // Every section appears in the strip, including the ones this role may not
  // open: seeing that a section exists and is closed to you is more use than
  // a strip that silently changes shape between accounts, and it makes the
  // control's layout the same everywhere it is deployed.
  const tabs = SECTIONS.map((item) => {
    const disabled = !allowed(item)
    return {
      id: item.id,
      // A lock in place of the section's own icon, so the state is readable
      // at a glance rather than only from the greying - which is easy to miss
      // on a plant-floor panel in daylight.
      icon: disabled ? <Lock size="1em" aria-hidden="true" /> : item.icon,
      label: item.label[language] ?? item.label.en,
      disabled,
      disabledHint: LOCKED_HINT[language] ?? LOCKED_HINT.en,
    }
  })

  return (
    <div className="main-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Tabs
        tabs={tabs}
        activeId={section}
        onChange={setRequested}
        language={language}
        label={STRIP_LABEL[language] ?? STRIP_LABEL.en}
      />

      {/*
        Only the open section is mounted, so each starts clean when it is
        returned to - a half-typed password should not survive a trip to the
        user list and back.

        The panel is keyed by section so React replaces it rather than
        reconciling one section's markup into the other's, which would carry
        focus and scroll position across a switch.
      */}
      <TabPanel key={section} id={section}>
        {section === 'password'
          ? (
            <ChangePassword
              language={language}
              username={username}
              message={passwordMessage}
              // Purely outbound: the container owns verification and
              // persistence, so the form only reports the request and waits
              // for ChangePasswordMessage to say what happened.
              onSubmit={(request) => {
                // The outcome of an earlier attempt belongs to that attempt.
                // Left standing, it would be re-applied when the next message
                // arrives with the same code and seq.
                setPasswordMessage(null)
                fireRequest('onChangePassword', request, fire)
              }}
            />
          )
          : (
            <OwnedUsers
              language={language}
              message={addUserMessage}
              users={users}
              usersStatus={usersStatus}
              onReload={askForUsers}
              // The signed-in account owns what it creates. Passed from here
              // rather than read inside the section, so the section stays a
              // description of its own UI and the container's value has one
              // route into it.
              owner={username}
              // Purely outbound: the container owns persistence, so the row
              // only reports the draft and waits for AddUserMessage to say
              // what happened.
              onAddUser={(draft) => {
                // The outcome of an earlier attempt belongs to that attempt.
                // Left standing, it would be re-applied when the next message
                // arrives with the same code and seq.
                setAddUserMessage(null)
                fireRequest('onAddUser', draft, fire)
              }}
            />
          )}
      </TabPanel>
    </div>
  )
}

/**
 * Send a request as a JSON string.
 *
 * Guarded because the payload is assembled from operator input: a value that
 * cannot be serialized would otherwise throw out of the event handler and
 * leave the form looking as though nothing happened.
 *
 * The failure is reported rather than swallowed, since the form is meanwhile
 * sitting in a pending state waiting for an answer that will never come.
 */
function fireRequest(event, request, fire) {
  try {
    fire(event, JSON.stringify(request))
  } catch (error) {
    console.warn(`[UserManager] ${event}: request is not serializable`, error)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
