////////////////////////////////////////////
// WinCC Unified contract owner — plain classic script, no bundler.
//
// WebCC starts before React and forwards TIA property changes to the UI.
window.RecipeBridge = {
  connected: false,
  // Whether a container is present at all. Distinct from `connected`: absent
  // means standalone (browser/dev, render immediately), present means we must
  // wait for the handshake before rendering.
  hasContainer: typeof WebCC !== 'undefined',
  // Set once the handshake has settled either way, so the UI can tell "still
  // waiting" from "tried and failed".
  settled: false,
  language: 'en',
  selectedItemNumber: 0,
  recipeItemsPerPage: 5,
  showTemplate: true,
  // Rows supplied by the container through CreateCards. Null means "never
  // supplied", which is distinct from an empty array: empty is a real result
  // that renders no cards, null lets the template stand in.
  recipes: null,
  pending: [],
  onLanguage: null,
  onSelectedItemNumber: null,
  onRecipeItemsPerPage: null,
  onShowTemplate: null,
  onRecipes: null,
  // Filled in by React; called when connected/settled changes so the gate can
  // re-render. `connected` is a plain field and is not observable on its own.
  onConnected: null,
};

/**
 * Coerce a numbered-key object into an array, passing a real array through.
 *
 * Marshalling an array across the container boundary commonly drops the array
 * type and delivers {"0": row, "1": row, ...} instead. The keys are sorted
 * numerically rather than taken in Object.keys order, because that order is
 * only guaranteed ascending for integer-like keys up to 2^32-1 and a payload
 * that arrives with string keys would otherwise put "10" before "2" and
 * silently reorder the cards.
 *
 * Returns null when the value is neither shape, so the caller can reject it.
 */
function toRowArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;

  var keys = Object.keys(value);
  // An object with no keys is an empty result, not a malformed one.
  if (!keys.length) return [];
  // Every key must be a non-negative integer; anything else means this is a
  // record that happens to be an object, not a disguised array.
  for (var i = 0; i < keys.length; i++) {
    if (!/^(0|[1-9][0-9]*)$/.test(keys[i])) return null;
  }
  keys.sort(function (a, b) { return Number(a) - Number(b); });

  var rows = [];
  for (var j = 0; j < keys.length; j++) rows.push(value[keys[j]]);
  return rows;
}

/**
 * Accept rows for the recipe cards.
 *
 * Lives on the bridge rather than only inside the contract object, because the
 * contract is registered by WebCC.start and that never runs standalone. Routing
 * both the container's call and a console injection through here means testing
 * in a plain browser exercises the same validation the container hits.
 */
function bridgeCreateCards(data) {
  var rows = data;
  console.log("Created cards:", data)
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch (e) {
      console.warn('[RecipePage] CreateCards: payload is not valid JSON', e);
      setStatus('CreateCards: invalid JSON');
      return false;
    }
  }
  // Kept separate from `rows`, which toRowArray overwrites with null on
  // refusal: describing the post-conversion value would only ever report
  // "object / [object Null]" and say nothing about what actually arrived.
  var candidate = rows;
  rows = toRowArray(candidate);
  if (rows === null) {
    // Describe the payload rather than dumping it: a WinCC console renders an
    // object as [object Object], which says nothing about why it was refused.
    // The key list is what actually identifies the shape - an envelope, an
    // array-like with a length property, padded keys, and so on.
    var described = Object.prototype.toString.call(candidate);
    var keyNote = '';
    if (candidate && typeof candidate === 'object') {
      var seen = Object.keys(candidate);
      keyNote = ' keys=[' + seen.slice(0, 12).join(', ') +
        (seen.length > 12 ? ', ...+' + (seen.length - 12) : '') + ']';
    }
    console.warn('[RecipePage] CreateCards refused a payload.' +
      ' type=' + typeof candidate + ' tag=' + described + keyNote);
    console.warn('[RecipePage] raw payload follows:', candidate);
    try {
      console.warn('[RecipePage] as JSON:', JSON.stringify(candidate).slice(0, 600));
    } catch (e) {
      console.warn('[RecipePage] payload is not JSON-serializable:', e);
    }
    setStatus('CreateCards refused: ' + typeof candidate + keyNote);
    return false;
  }
  window.RecipeBridge.recipes = rows;
  bridgeDispatch('Recipes', rows);
  setStatus('CreateCards: ' + rows.length + ' row(s)');
  return true;
}

/** Mark the handshake settled and let React know it can re-evaluate the gate. */
function bridgeSettle(isConnected) {
  var b = window.RecipeBridge;
  b.connected = isConnected;
  b.settled = true;
  if (b.onConnected) b.onConnected();
}

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

      // Seed current values, then subscribe for later changes.
      try {
        var props = WebCC.Properties;
        console.log("props: ", props.Language);
        if (props) {
          window.RecipeBridge.language = props.Language;
          window.RecipeBridge.selectedItemNumber = props.selectedItemNumber;
          window.RecipeBridge.recipeItemsPerPage = props.RecipeItemsPerPage;
          window.RecipeBridge.showTemplate = props.showTemplate;
          bridgeDispatch('Language', props.Language);
          bridgeDispatch('SelectedItemNumber', props.selectedItemNumber);
          bridgeDispatch('RecipeItemsPerPage', props.RecipeItemsPerPage);
          bridgeDispatch('ShowTemplate', props.showTemplate);
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
            case 'showTemplate':
              window.RecipeBridge.showTemplate = val.value;
              bridgeDispatch('ShowTemplate', val.value);
              break;
            case 'RecipeItemsPerPage':
              // manifest declares minimum 1; drop anything the container
              // sends below that rather than rendering an empty page.
              if (val.value >= 1) {
                window.RecipeBridge.recipeItemsPerPage = val.value;
                bridgeDispatch('RecipeItemsPerPage', val.value);
              }
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
        console.log('[RecipePage] Print called with', data);
        setStatus('Print: ' + data);
      },

      /**
       * Supply the rows the recipe cards are built from.
       *
       * The manifest types the parameter as `object`, and three spellings of
       * the same list are accepted because the container decides which one
       * arrives: a real array, a JSON-encoded string of one, and a numbered-key
       * object ({"0": row, "1": row, ...}), which is what marshalling an array
       * across the boundary usually produces. A JSON string may itself decode
       * to either of the other two. Anything else is rejected here rather than
       * forwarded, so a malformed payload leaves the current cards alone
       * instead of blanking the list.
       *
       * Note this only delivers the rows. Whether they are displayed is the
       * showTemplate property's call: while it is on, the template keeps
       * rendering and these are held.
       */
      CreateCards: function (data) {
        bridgeCreateCards(data);
      }
    },
    events: ['onPressingIcon', 'onLoginOut', 'onLanguageChange', 'onRecipeItemsPerPageChange'],
    properties: {
      Language: 'en',
      selectedItemNumber: 0,
      RecipeItemsPerPage: 5,
      showTemplate: true
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
 */
/**
 * Same entry point the container's CreateCards method uses, exposed so the
 * control can be driven from the devtools console while running standalone:
 *
 *   RecipeBridge.createCards(payload)
 *
 * Returns whether the payload was accepted, so a console call reports itself
 * rather than failing silently.
 */
window.RecipeBridge.createCards = bridgeCreateCards;

window.RecipeBridge.fire = function (name, payload) {
  if (!window.WebCC || !WebCC.Events || !WebCC.Events.fire) {
    console.log('[NavigationBar] standalone: event ' + name + ' not fired', payload);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
