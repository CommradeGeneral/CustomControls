////////////////////////////////////////////
// WinCC Unified contract owner — plain classic script, no bundler.
//
// WebCC starts before React and forwards TIA property changes to the UI.
//
// Carries the Print and ChangePasswordMessage methods, the onChangePassword
// event, and three properties - Language, Username and Role. Around them is
// the plumbing every contract needs whatever is added later: the handshake and
// its settled/connected flags, the dispatch queue that survives React mounting
// late, and the standalone path.
//
// No password is hashed, verified or stored here. bcrypt lives container-side
// in TIA (see sql/tia/onSignIn.js), so the control's whole part is to carry
// what was typed across the boundary and wait to be told what happened.
//
// Username reaches the UI: it names the account in the change-password
// section, and is echoed back to the container in the onChangePassword
// request so the container can see which account is meant. Role decides
// which sections the operator sees - bit 0 gates the Users section, which
// src/lib/permissions.js defines.
//
// Adding a method means three things, and forgetting any one of them is the
// usual bug: declare it in manifest.json, implement it in the contract object
// below, and give React somewhere to hear it - a field to hold the value and
// an `on*` callback beside onLanguage.
window.UserBridge = {
  connected: false,
  // Whether a container is present at all. Distinct from `connected`: absent
  // means standalone (browser/dev, render immediately), present means we must
  // wait for the handshake before rendering.
  hasContainer: typeof WebCC !== 'undefined',
  // Set once the handshake has settled either way, so the UI can tell "still
  // waiting" from "tried and failed".
  settled: false,
  language: 'en',
  // Who the container says is signed in, and what they may do. Empty and 0 are
  // the signed-out pair: the control never authenticates anyone itself, so
  // until the container supplies these it must assume the least it can.
  username: '',
  role: 0,
  // Anything dispatched before React attached its handlers, replayed on mount.
  // Without this a property that arrives during the handshake is lost, since
  // the container does not re-send it.
  pending: [],
  onLanguage: null,
  onUsername: null,
  onRole: null,
  onChangePasswordMessage: null,
  onAddUserMessage: null,
  // The accounts the Users section lists, and what it shows in their place.
  // Null means "never answered", which is the loading state - distinct from
  // an empty array, which is a real answer with nothing in it.
  users: null,
  // 0 loaded, 1 database unreachable, 2 refused, 3 unspecified. Starts at -1
  // for "asked nothing yet", so the section can tell a first open from a
  // failure.
  usersStatus: -1,
  onUsers: null,
  // Filled in by React; called when connected/settled changes so the gate can
  // re-render. `connected` is a plain field and is not observable on its own.
  onConnected: null,
};

/**
 * A role number from whatever the container sent.
 *
 * Fails closed: anything that is not a non-negative integer becomes 0, which
 * the schema requires to be the least privileged role. That covers the string
 * "2" a marshalled INT can arrive as, and equally the absent value, the empty
 * string, NaN, a negative and a fractional one.
 *
 * Deliberately not clamped at the top. The database stores the number and TIA
 * decides what each one means, so a role this build has never heard of is
 * still a real role - dropping it to 0 would silently demote a user the
 * container had every right to promote.
 */
function toRole(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) return 0;
  // Truncated rather than rounded: 1.9 is a malformed 1, not a 2, and rounding
  // it up would grant a role that was never sent.
  number = Math.trunc(number);
  return number < 0 ? 0 : number;
}

/**
 * A username string from whatever the container sent.
 *
 * A NULL column crossing the boundary can arrive as the literal text "null",
 * which is truthy and would otherwise be displayed as a signed-in user of that
 * name. Absent in any spelling becomes '', which is the signed-out value.
 */
function toUsername(value) {
  if (value === null || value === undefined) return '';
  var text = String(value).trim();
  return (text === 'null' || text === 'undefined') ? '' : text;
}

/**
 * Coerce a numbered-key object into an array, passing a real array through.
 *
 * Marshalling an array across the container boundary commonly drops the array
 * type and delivers {"0": row, "1": row, ...} instead. The keys are sorted
 * numerically rather than taken in Object.keys order, because that order is
 * only guaranteed ascending for integer-like keys and a payload arriving with
 * string keys would otherwise put "10" before "2" and reorder the rows.
 *
 * Returns null when the value is neither shape, so the caller can reject it.
 */
function toRowArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;

  var keys = Object.keys(value);
  if (!keys.length) return [];
  for (var i = 0; i < keys.length; i++) {
    if (!/^(0|[1-9][0-9]*)$/.test(keys[i])) return null;
  }
  keys.sort(function (a, b) { return Number(a) - Number(b); });

  var rows = [];
  for (var j = 0; j < keys.length; j++) rows.push(value[keys[j]]);
  return rows;
}

/**
 * Accept the account list, or the failure that stands in for it.
 *
 * Lives on the bridge rather than only inside the contract object, because the
 * contract is registered by WebCC.start and that never runs standalone.
 * Routing both the container's call and a console injection through here means
 * testing in a plain browser exercises the same validation the container hits.
 */
function bridgeLoadUsers(MessageNumber, Timeout, Payload) {
  var b = window.UserBridge;
  var code = Number(MessageNumber);
  if (!Number.isFinite(code)) code = 3;

  if (code !== 0) {
    b.usersStatus = code;
    bridgeDispatch('Users', { status: code, rows: null, duration: Number(Timeout) || 0 });
    setStatus('LoadUsers: failed (' + code + ')');
    return false;
  }

  var payload = Payload;
  if (typeof payload === 'string') {
    if (payload === '') {
      payload = [];
    } else {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.warn('[UserManager] LoadUsers: payload is not valid JSON', e);
        b.usersStatus = 3;
        bridgeDispatch('Users', { status: 3, rows: null, duration: Number(Timeout) || 0 });
        setStatus('LoadUsers: invalid JSON');
        return false;
      }
    }
  }

  var rows = toRowArray(payload);
  if (rows === null) {
    // Described rather than dumped: a WinCC console renders an object as
    // [object Object], which says nothing about why it was refused.
    var described = Object.prototype.toString.call(payload);
    console.warn('[UserManager] LoadUsers refused a payload. type=' +
      typeof payload + ' tag=' + described);
    b.usersStatus = 3;
    bridgeDispatch('Users', { status: 3, rows: null, duration: Number(Timeout) || 0 });
    setStatus('LoadUsers refused: ' + typeof payload);
    return false;
  }

  b.users = rows;
  b.usersStatus = 0;
  bridgeDispatch('Users', { status: 0, rows: rows, duration: 0 });
  setStatus('LoadUsers: ' + rows.length + ' row(s)');
  return true;
}

/** Mark the handshake settled and let React know it can re-evaluate the gate. */
function bridgeSettle(isConnected) {
  var b = window.UserBridge;
  b.connected = isConnected;
  b.settled = true;
  if (b.onConnected) b.onConnected();
}

/**
 * Hand a value to React, or queue it if React has not mounted yet.
 *
 * `kind` names the channel: 'Language' is delivered to onLanguage. A handler
 * that is not attached yet does not lose its value - it is replayed from
 * `pending` once useBridge attaches.
 */
function bridgeDispatch(kind, value) {
  var b = window.UserBridge;
  var handler = b['on' + kind];
  if (handler) handler(value);
  else b.pending.push({ kind: kind, value: value });
}

function setStatus(msg) {
  var el = document.getElementById('status');
  if (el) el.textContent = msg;
}

////////////////////////////////////////////
// Initialize the custom control.
//
// Guarded because this file also runs standalone (plain browser, `npm run
// dev`), where no container has defined WebCC. A bare WebCC.start() there is a
// ReferenceError that aborts the script before `fire` below is attached, so the
// absence has to be handled rather than thrown.
if (typeof WebCC === 'undefined') {
  setStatus('standalone: no container');
  bridgeSettle(false);
} else {
WebCC.start(
  // callback function; occurs when the connection is done or failed.
  function (result) {
    if (result) {
      bridgeSettle(true);
      setStatus('connected');

      // Seed current values, then subscribe for later changes. Both halves are
      // needed: the subscription only reports changes, so without the seeding
      // a property that never changes again would never arrive at all.
      try {
        var props = WebCC.Properties;
        if (props) {
          window.UserBridge.language = props.Language;
          bridgeDispatch('Language', props.Language);
          // Normalized on the way in, so every reader sees the coerced value
          // rather than each having to repeat the check.
          window.UserBridge.username = toUsername(props.Username);
          bridgeDispatch('Username', window.UserBridge.username);
          window.UserBridge.role = toRole(props.Role);
          bridgeDispatch('Role', window.UserBridge.role);
        }
      } catch (e) {
        console.warn('[UserManager] property read failed:', e);
      }

      if (WebCC.onPropertyChanged) {
        WebCC.onPropertyChanged.subscribe(function (val) {
          switch (val.key) {
            case 'Language':
              window.UserBridge.language = val.value;
              bridgeDispatch('Language', val.value);
              break;
            /*
             * A sign-out is a property change like any other: the container
             * sets Username back to '' and Role back to 0. Both are therefore
             * forwarded unconditionally rather than being filtered for a
             * "useful" value - dropping the empty one is what would leave the
             * last user's name on screen after they signed out.
             */
            case 'Username':
              window.UserBridge.username = toUsername(val.value);
              bridgeDispatch('Username', window.UserBridge.username);
              break;
            case 'Role':
              window.UserBridge.role = toRole(val.value);
              bridgeDispatch('Role', window.UserBridge.role);
              break;
          }
        });
      }
    } else {
      bridgeSettle(false);
      setStatus('connection failed');
    }
  },
  // contract (see also manifest.json)
  {
    methods: {
      /**
       * Diagnostic sink for the container: whatever it sends is logged here.
       *
       * Deliberately does not touch React — it exists to prove the
       * container -> control direction of the contract is wired, which is the
       * half that a fired event cannot demonstrate.
       */
      Print: function (data) {
        console.log('[UserManager] Print called with', data);
        setStatus('Print: ' + data);
      },

      /**
       * Report the outcome of a change-password attempt.
       *
       * 0 changed, 1 the current password was wrong, 2 the new one was
       * refused by policy, 3 it could not be written. Any other number clears
       * the message, which is how the container withdraws one without waiting
       * for a timeout.
       *
       * The codes are distinct because the form does something different with
       * each: only 1 points the operator back at the current-password field,
       * and only 0 is safe to clear the typed values on.
       *
       * Timeout is milliseconds; zero or less leaves the message until the
       * operator edits the form.
       */
      ChangePasswordMessage: function (MessageNumber, Timeout) {
        bridgeDispatch('ChangePasswordMessage', {
          code: Number(MessageNumber),
          duration: Number(Timeout) || 0
        });
      },

      /**
       * Report the outcome of a create attempt on the new-user row.
       *
       * 0 created, 1 the username is taken, 2 the password was refused by
       * policy, 3 it could not be written. Any other number clears the
       * message, which is how the container withdraws one without waiting for
       * a timeout.
       *
       * The codes are distinct because the row does something different with
       * each: only 0 is safe to close it on, and only 1 points the operator
       * back at the username field.
       */
      AddUserMessage: function (MessageNumber, Timeout) {
        bridgeDispatch('AddUserMessage', {
          code: Number(MessageNumber),
          duration: Number(Timeout) || 0
        });
      },

      /**
       * Supply the accounts the Users section lists.
       *
       * 0 means the rows follow in Payload; anything else is a failure and
       * Payload is ignored. The rows already on screen are kept on a failure
       * rather than cleared, so a refresh that breaks does not blank a list
       * that was working.
       */
      LoadUsers: function (MessageNumber, Timeout, Payload) {
        bridgeLoadUsers(MessageNumber, Timeout, Payload);
      }
    },
    events: ['onChangePassword', 'onAddUser', 'onPressUserTab'],
    properties: {
      Language: 'en',
      // The signed-out pair, matching the manifest's defaults. These are what
      // the control shows if the container connects and never supplies them.
      Username: '',
      Role: 0,
    }
  },
  // placeholder to include additional Unified dependencies (not used here)
  [],
  // connection timeout
  10000
);
}

/**
 * Fire a contract event.
 *
 * The payload is passed through exactly as given: WebCC maps a single value
 * onto the single argument declared for the event in manifest.json. Do not
 * wrap it in an array - the container then binds nothing.
 *
 * Standalone (no container) is detected up front rather than caught, so a
 * genuine failure inside the container still reports itself.
 *
 * Standalone the call is logged rather than dropped in silence: running in a
 * plain browser is how the UI gets built, and an event that vanishes without
 * trace makes a working form look broken. The return value still says whether
 * anything was actually sent.
 */
/**
 * Same entry point the container's LoadUsers method uses, exposed so the
 * control can be driven from the devtools console while running standalone:
 *
 *   UserBridge.loadUsers(0, 0, JSON.stringify([{username: 'ahmed'}]))
 */
window.UserBridge.loadUsers = bridgeLoadUsers;

window.UserBridge.fire = function (name, payload) {
  if (!window.WebCC || !WebCC.Events || !WebCC.Events.fire) {
    console.log('[UserManager] standalone: ' + name + ' not fired', payload);
    setStatus('standalone: ' + name);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
