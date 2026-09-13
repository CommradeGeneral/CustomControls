////////////////////////////////////////////
// WinCC Unified contract owner — plain classic script, no bundler.
//
// WebCC starts before React and forwards TIA property changes to the UI.
window.RecipeBridge = {
  connected: false,
  language: 'en',
  selectedItemNumber: 0,
  pending: [],
  onLanguage: null,
  onSelectedItemNumber: null,
};

function bridgeDispatch(kind, value) {
  var b = window.RecipeBridge;
  var handler = b['on' + kind];
  if (handler) handler(value);
  else b.pending.push({ kind: kind, value: value });
}

function setStatus(msg) {
  var el = document.getElementById('status');
  if (el) el.textContent = msg;
  console.log('[NavigationBar] ' + msg);
}

////////////////////////////////////////////
// Initialize the custom control
WebCC.start(
  // callback function; occurs when the connection is done or failed.
  function (result) {
    if (result) {
      window.RecipeBridge.connected = true;
      setStatus('connected');

      // Seed current values, then subscribe for later changes.
      try {
        var props = WebCC.Properties;
        if (props) {
          window.RecipeBridge.language = props.Language;
          window.RecipeBridge.selectedItemNumber = props.selectedItemNumber;
          bridgeDispatch('Language', props.Language);
          bridgeDispatch('SelectedItemNumber', props.selectedItemNumber);
        }
      } catch (e) {
        console.warn('[NavigationBar] property read failed:', e);
      }

      if (WebCC.onPropertyChanged) {
        WebCC.onPropertyChanged.subscribe(function (val) {
          switch (val.key) {
            case 'Language':
              window.RecipeBridge.language = val.value;
              bridgeDispatch('Language', val.value);
              break;
            case 'selectedItemNumber':
              if (val.value >= 0 && val.value <= 3) {
                window.RecipeBridge.selectedItemNumber = val.value;
                bridgeDispatch('SelectedItemNumber', val.value);
              }
              break;
          }
        });
      }
    } else {
      setStatus('connection failed');
    }
  },
  // contract (see also manifest.json)
  {
    events: ['onPressingIcon', 'onLoginOut', 'onLanguageChange'],
    properties: {
      Language: 'en',
      selectedItemNumber: 0
    }
  },
  // placeholder to include additional Unified dependencies (not used here)
  [],
  // connection timeout
  10000
);

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
window.RecipeBridge.fire = function (name, payload) {
  if (!window.WebCC || !WebCC.Events || !WebCC.Events.fire) {
    console.log('[NavigationBar] standalone: event ' + name + ' not fired', payload);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
