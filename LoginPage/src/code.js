////////////////////////////////////////////
// WinCC Unified contract owner — plain classic script, no bundler.
//
// WebCC starts before React and forwards TIA property changes to the UI.
//
// React is NOT involved in the handshake. It mounts afterwards from App.jsx and
// only talks to window.LoginBridge, so adding a framework cannot affect
// contract registration. Do not move WebCC.start into a module or an effect.
window.LoginBridge = {
  connected: false,
  // Whether a container is present at all. Distinct from `connected`: absent
  // means standalone (browser/dev, render immediately), present means we must
  // wait for the handshake before rendering.
  hasContainer: typeof WebCC !== 'undefined',
  // Set once the handshake has settled either way, so the UI can tell "still
  // waiting" from "tried and failed".
  settled: false,
  language: 'en',
  // Replayed into React when it registers its handlers.
  pending: [],
  onLanguage: null,
  onLoginMessage: null,
  // Filled in by React; called when connected/settled changes so the gate can
  // re-render. `connected` is a plain field and is not observable on its own.
  onConnected: null,
};

/** Mark the handshake settled and let React know it can re-evaluate the gate. */
function bridgeSettle(isConnected) {
  var b = window.LoginBridge;
  b.connected = isConnected;
  b.settled = true;
  if (b.onConnected) b.onConnected();
}

function bridgeDispatch(kind, value) {
  var b = window.LoginBridge;
  var handler = b['on' + kind];
  if (handler) handler(value);
  else b.pending.push({ kind: kind, value: value });
}

function setStatus(msg) {
  var el = document.getElementById('status');
  if (el) el.textContent = msg;
  // console.log('[LoginPage] ' + msg);
}

/**
 * Raise the card's message.
 *
 * Both arguments are passed through as one payload so React sees a single
 * state change: a code the UI maps to a localised string, and a fade delay in
 * milliseconds (0 or less means the message stays).
 */
function bridgeMessage(kind, messageNumber, timeout) {
  bridgeDispatch(kind, {
    code: Number(messageNumber),
    duration: Number(timeout) || 0,
  });
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

      // Seed the current property value, then subscribe for later changes.
      try {
        var props = WebCC.Properties;
        if (props) {
          window.LoginBridge.language = props.Language;
          bridgeDispatch('Language', props.Language);
        }
      } catch (e) {
        console.warn('[LoginPage] property read failed:', e);
      }

      if (WebCC.onPropertyChanged) {
        WebCC.onPropertyChanged.subscribe(function (val) {
          if (val.key === 'Language') {
            window.LoginBridge.language = val.value;
            bridgeDispatch('Language', val.value);
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
        console.log('[LoginPage] Print called with', data);
        setStatus('Print: ' + data);
      },
      /**
       * Show a fixed message under the sign-in button.
       *
       * 1 = invalid username or password, 2 = badly formatted username;
       * anything else withdraws the message.
       */
      LoginMessage: function (messageNumber, timeout) {
        // console.log('[LoginPage] LoginMessage called with', messageNumber, timeout);
        bridgeMessage('LoginMessage', messageNumber, timeout);
      }
    },
    events: ['onSignIn', 'onLanguageChange'],
    properties: {
      Language: 'en',
    }
  },
  // placeholder to include additional Unified dependencies (not used here)
  [],
  // connection timeout
  10000
);
}

/**
 * Same entry point the container's LoginMessage method uses, exposed so the
 * control can be driven from the devtools console while running standalone:
 *
 *   LoginBridge.showLoginMessage(1, 3000)
 */
window.LoginBridge.showLoginMessage = function (messageNumber, timeout) {
  bridgeMessage('LoginMessage', messageNumber, timeout);
};

/**
 * Fire a contract event.
 *
 * The payload is passed through exactly as given: WebCC maps a single value
 * onto the single argument declared for the event in manifest.json. Do not
 * wrap it in an array - the container then binds nothing.
 *
 * Standalone (no container) is detected up front rather than caught, so a
 * genuine failure inside the container still reports itself.
 */
window.LoginBridge.fire = function (name, payload) {
  if (!window.WebCC || !WebCC.Events || !WebCC.Events.fire) {
    // console.log('[LoginPage] standalone: event ' + name + ' not fired', payload);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
