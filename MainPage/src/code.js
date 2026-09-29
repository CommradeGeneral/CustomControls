////////////////////////////////////////////
// WinCC Unified contract owner — plain classic script, no bundler.
//
// WebCC starts before React and forwards TIA property changes to the UI.
//
// Carries the Print method, the Language property and the onMotorDoubleClick
// event. What is here besides
// them is the plumbing every contract needs whatever is added later: the
// handshake and its settled/connected flags, the dispatch queue that survives
// React mounting late, and the standalone path.
//
// Adding a method means three things, and forgetting any one of them is the
// usual bug: declare it in manifest.json, implement it in the contract object
// below, and give React somewhere to hear it - a field to hold the value and
// an `on*` callback beside onLanguage.
window.MainBridge = {
  connected: false,
  // Whether a container is present at all. Distinct from `connected`: absent
  // means standalone (browser/dev, render immediately), present means we must
  // wait for the handshake before rendering.
  hasContainer: typeof WebCC !== 'undefined',
  // Set once the handshake has settled either way, so the UI can tell "still
  // waiting" from "tried and failed".
  settled: false,
  language: 'en',
  // Anything dispatched before React attached its handlers, replayed on mount.
  // Without this a property that arrives during the handshake is lost, since
  // the container does not re-send it.
  pending: [],
  onLanguage: null,
  // Filled in by React; called when connected/settled changes so the gate can
  // re-render. `connected` is a plain field and is not observable on its own.
  onConnected: null,
};

/** Mark the handshake settled and let React know it can re-evaluate the gate. */
function bridgeSettle(isConnected) {
  var b = window.MainBridge;
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
  var b = window.MainBridge;
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
          window.MainBridge.language = props.Language;
          bridgeDispatch('Language', props.Language);
        }
      } catch (e) {
        console.warn('[MainPage] property read failed:', e);
      }

      if (WebCC.onPropertyChanged) {
        WebCC.onPropertyChanged.subscribe(function (val) {
          switch (val.key) {
            case 'Language':
              window.MainBridge.language = val.value;
              bridgeDispatch('Language', val.value);
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
        console.log('[MainPage] Print called with', data);
        setStatus('Print: ' + data);
      }
    },
    events: ['onMotorDoubleClick'],
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
 * Fire a contract event.
 *
 * The payload is passed through exactly as given: WebCC maps a single value
 * onto the single argument declared for the event in manifest.json. Do not
 * wrap it in an array - the container then binds nothing.
 *
 * Standalone the call is logged rather than dropped in silence: running in a
 * plain browser is how the UI gets built, and an event that vanishes without
 * trace makes a working control look broken. The return value still says
 * whether anything was actually sent.
 *
 * Declared events: onMotorDoubleClick (unit: string). A new one goes in
 * manifest.json and in the `events` list above, or the container drops it.
 */
window.MainBridge.fire = function (name, payload) {
  if (!window.WebCC || !WebCC.Events || !WebCC.Events.fire) {
    console.log('[MainPage] standalone: ' + name + ' not fired', payload);
    setStatus('standalone: ' + name);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
