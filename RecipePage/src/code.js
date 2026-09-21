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
  recipeItemsPerPage: 5,
  // Rows supplied by the container through CreateCards. Null means "never
  // supplied" and an empty array a real result with nothing in it; both render
  // no cards, but the two mean different things to a reader.
  recipes: null,
  // Material catalogue supplied through LoadAvailableMaterials. Until it
  // arrives the component dropdowns have nothing to offer, so a recipe cannot
  // be given a material the plant does not stock.
  materials: null,
  // The recipe the detail page is showing, supplied through CreateRecipePage.
  // Null means no page is open, which is distinct from an empty object.
  recipePage: null,
  // What the card list shows in place of its rows, set through
  // LoadingCardsMessage: 1 while the query behind CreateCards runs, 2 when it
  // failed, 0 for neither.
  loadingCards: 0,
  pending: [],
  onLanguage: null,
  onRecipeItemsPerPage: null,
  onRecipes: null,
  onMaterials: null,
  onRecipePage: null,
  onLoadingCards: null,
  onNewRecipeMessage: null,
  onDeleteRecipeMessage: null,
  onClearSidePage: null,
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
 * Accept a row list from the container and hand it to React.
 *
 * Shared by every method that takes one, because they all face the same three
 * spellings: a real array, a JSON-encoded string of one, and a numbered-key
 * object, which is what marshalling an array across the boundary usually
 * produces. A JSON string may itself decode to either of the other two.
 *
 * `label` names the method in every log line, `field` is the bridge property
 * the rows are stored on, and `kind` the bridgeDispatch channel React listens
 * on. Anything malformed is refused here rather than forwarded, so a bad
 * payload leaves the current data alone instead of blanking it.
 *
 * Returns whether the payload was accepted.
 */
function bridgeAcceptRows(label, field, kind, data) {
  var rows = data;
  // console.log('[RecipePage] ' + label + ' received:', data);
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch (e) {
      console.warn('[RecipePage] ' + label + ': payload is not valid JSON', e);
      setStatus(label + ': invalid JSON');
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
    console.warn('[RecipePage] ' + label + ' refused a payload.' +
      ' type=' + typeof candidate + ' tag=' + described + keyNote);
    console.warn('[RecipePage] raw payload follows:', candidate);
    try {
      console.warn('[RecipePage] as JSON:', JSON.stringify(candidate).slice(0, 600));
    } catch (e) {
      console.warn('[RecipePage] payload is not JSON-serializable:', e);
    }
    setStatus(label + ' refused: ' + typeof candidate + keyNote);
    return false;
  }
  window.RecipeBridge[field] = rows;
  bridgeDispatch(kind, rows);
  setStatus(label + ': ' + rows.length + ' row(s)');
  return true;
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
  var accepted = bridgeAcceptRows('CreateCards', 'recipes', 'Recipes', data);
  // Rows arriving are the end of the wait, so the placeholder clears itself.
  // A container that always pairs the two never has to send 0, and one that
  // forgets cannot leave the list stuck under it.
  if (accepted) bridgeLoadingCards(0);
  return accepted;
}

/**
 * Set what the card list shows in place of its rows: 1 is the loading
 * placeholder, 2 the failure notice, anything else clears both.
 *
 * Carried as the number itself rather than a flag, so the three states stay
 * distinct - a failure is not "not loading", and collapsing them would leave
 * the list looking merely empty after a query that actually broke.
 *
 * Lives on the bridge rather than only inside the contract object, for the
 * same reason as the others: the contract is registered by WebCC.start, which
 * never runs standalone, so routing through here keeps a console call and a
 * container call on the same path.
 */
function bridgeLoadingCards(MessageNumber) {
  var code = Number(MessageNumber);
  if (code !== 1 && code !== 2) code = 0;
  window.RecipeBridge.loadingCards = code;
  bridgeDispatch('LoadingCards', code);
  setStatus('LoadingCardsMessage: ' +
    (code === 1 ? 'loading' : code === 2 ? 'failed' : 'cleared'));
  return true;
}

/**
 * Accept the material catalogue the component rows are chosen from.
 *
 * Same contract and the same standalone reasoning as bridgeCreateCards; the
 * rows are the recipe_material table, so each carries at least a code and a
 * name, and whatever else the query selected is passed through untouched.
 */
function bridgeLoadAvailableMaterials(data) {
  return bridgeAcceptRows('LoadAvailableMaterials', 'materials', 'Materials', data);
}

/**
 * Accept the recipe the detail page shows.
 *
 * One object rather than a row list, so this does not use bridgeAcceptRows.
 * The components inside it still go through toRowArray, because a nested array
 * faces the same marshalling that turns a list into {"0": row, "1": row, ...}.
 *
 * An empty payload - '', null, or an object with no code - closes the page
 * rather than opening a blank one, which is how the container withdraws it.
 */
function bridgeCreateRecipePage(data) {
  var payload = data;
  // console.log('[RecipePage] CreateRecipePage received:', data);

  if (payload === '' || payload === null || payload === undefined) {
    window.RecipeBridge.recipePage = null;
    bridgeDispatch('RecipePage', null);
    setStatus('CreateRecipePage: closed');
    return true;
  }

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.warn('[RecipePage] CreateRecipePage: payload is not valid JSON', e);
      setStatus('CreateRecipePage: invalid JSON');
      return false;
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    console.warn('[RecipePage] CreateRecipePage refused a payload.' +
      ' type=' + typeof payload + ' tag=' + Object.prototype.toString.call(payload));
    setStatus('CreateRecipePage refused: ' + typeof payload);
    return false;
  }

  // Normalized here rather than in React, so the component can assume an
  // array and a missing one is not mistaken for a recipe with no components.
  var components = toRowArray(payload.components);
  payload.components = components === null ? [] : components;

  window.RecipeBridge.recipePage = payload;
  bridgeDispatch('RecipePage', payload);
  setStatus('CreateRecipePage: ' + payload.components.length + ' component(s)');
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
  // console.log('[RecipePage] ' + msg);
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
        // console.log("props: ", props.Language);
        if (props) {
          window.RecipeBridge.language = props.Language;
          window.RecipeBridge.recipeItemsPerPage = props.RecipeItemsPerPage;
          bridgeDispatch('Language', props.Language);
          bridgeDispatch('RecipeItemsPerPage', props.RecipeItemsPerPage);
        }
      } catch (e) {
        console.warn('[RecipePage] property read failed:', e);
      }

      if (WebCC.onPropertyChanged) {
        WebCC.onPropertyChanged.subscribe(function (val) {
          switch (val.key) {
            case 'Language':
              window.RecipeBridge.language = val.value;
              bridgeDispatch('Language', val.value);
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
       */
      CreateCards: function (data) {
        bridgeCreateCards(data);
      },

      /**
       * Say what the card list shows in place of its rows while CreateCards
       * has not delivered any: 1 is the loading placeholder, 2 the failure
       * notice, and any other number clears both.
       *
       * The cards underneath are kept rather than cleared, so refreshing an
       * already-populated list does not blank it before the new rows land -
       * and a failed refresh leaves the last good rows on screen rather than
       * replacing them with an error.
       */
      LoadingCardsMessage: function (MessageNumber) {
        // console.log('[RecipePage] LoadingCardsMessage called with', MessageNumber);
        bridgeLoadingCards(MessageNumber);
      },

      /**
       * Supply the materials a component row can choose from.
       *
       * Accepts the same three payload spellings as CreateCards. Each row is
       * expected to carry the recipe_material columns - code and name at
       * minimum, since those are what the two dropdowns render.
       */
      LoadAvailableMaterials: function (data) {
        bridgeLoadAvailableMaterials(data);
      },

      /**
       * Open the detail page for one recipe.
       *
       * Takes a single object rather than a row list, so it does not go
       * through bridgeAcceptRows: the payload is the recipe_header row with a
       * `components` array on it, which is what a join of recipe_components to
       * recipe_material returns.
       *
       * An empty payload closes the page and returns the pane to its empty
       * state, which is how the container withdraws it without a second
       * method.
       */
      CreateRecipePage: function (data) {
        bridgeCreateRecipePage(data);
      },

      /**
       * Report the outcome of a create attempt on the new-recipe form.
       *
       * 0 = the recipe was created, 1 = it could not be written to the
       * database. Any other number clears the message, which is how the
       * container withdraws one without waiting for a timeout.
       *
       * timeout is milliseconds; zero or less leaves the message on screen
       * until the form is closed or edited.
       */
      NewRecipeMessage: function (MessageNumber, Timeout) {
        // console.log('[RecipePage] NewRecipeMessage called with', MessageNumber, Timeout);
        bridgeDispatch('NewRecipeMessage', {
          code: Number(MessageNumber),
          duration: Number(Timeout) || 0
        });
      },

      /**
       * Report what became of a delete the operator confirmed.
       *
       * 0 closes the detail page, since the recipe it describes is gone; 1
       * leaves it open with the error, so the operator can read why and the
       * row is still in front of them. Any other number just clears the
       * pending state.
       *
       * Until this arrives the page stays in its pending state, which is what
       * stops a second confirm while the first is still being written.
       */
      DeleteRecipeMessage: function (MessageNumber, Timeout) {
        // console.log('[RecipePage] DeleteRecipeMessage called with', MessageNumber, Timeout);
        bridgeDispatch('DeleteRecipeMessage', {
          code: Number(MessageNumber),
          duration: Number(Timeout) || 0
        });
      },

      /**
       * Return the main pane to its empty state, dropping whichever of the
       * detail view or the new-recipe form is showing.
       *
       * Takes no parameters, so it carries a counter rather than a value: the
       * React side has to be able to tell a second call from a repeat of the
       * first, and identical state would be ignored as equal.
       */
      ClearSidePage: function () {
        // console.log('[RecipePage] ClearSidePage called');
        bridgeDispatch('ClearSidePage', Date.now());
      }
    },
    events: ['onCardSelect', 'onRecipeCreate', 'onRecipeDelete', 'onRecipeUpdate', 'onNewRecipeButton', 'onReloadCards', 'onSidePageChange', 'onRecipeItemsPerPageChange'],
    properties: {
      Language: 'en',
          RecipeItemsPerPage: 5,
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

/** Same, for the material catalogue: RecipeBridge.loadAvailableMaterials(x) */
window.RecipeBridge.loadAvailableMaterials = bridgeLoadAvailableMaterials;

/** Same, for the detail page: RecipeBridge.createRecipePage(payload) */
window.RecipeBridge.createRecipePage = bridgeCreateRecipePage;

/** Same, for the list placeholder: RecipeBridge.loadingCards(1) */
window.RecipeBridge.showLoadingCards = bridgeLoadingCards;

window.RecipeBridge.fire = function (name, payload) {
  if (!window.WebCC || !WebCC.Events || !WebCC.Events.fire) {
    // console.log('[RecipePage] standalone: event ' + name + ' not fired', payload);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
