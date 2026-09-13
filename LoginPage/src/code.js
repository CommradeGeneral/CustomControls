////////////////////////////////////////////
// WinCC Unified contract owner — plain classic script, no bundler.
//
// Structure is deliberately identical to the MinTest / MinTestReact controls
// that work in this project: this file runs in <head> before anything else and
// calls WebCC.start at top level with an empty extensions array.
//
// React is NOT involved in the handshake. It mounts afterwards from app.jsx and
// only talks to window.RecipeBridge, so the contract registration path is
// exactly the one already proven to work here. Do not move WebCC.start into a
// module or a React effect.

/**
 * Shared state between this script and the React tree.
 *
 * The `on*` slots are filled in by React once it mounts. The contract methods
 * below read them at call time and fall back to `pending`, so a call arriving
 * before React is ready is replayed rather than lost.
 */
window.RecipeBridge = {
  connected: false,
  // Latest values from the container, applied by React on mount.
  recipesJson: null,
  recipesPerPage: 5,
  language: 'en',
  // Replayed into React when it registers its handlers.
  pending: [],
  onUpdateRecipeList: null,
  onShowPage: null,
  onRecipesPerPage: null,
  onLanguage: null,
  onLoginMessage: null,
  onRegisterMessage: null,
  onConnected: null
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
  console.log('[RecipeList] ' + msg);
}

////////////////////////////////////////////
// Initialize the custom control
WebCC.start(
  // callback function; occurs when the connection is done or failed.
  function (result) {
    if (result) {
      window.RecipeBridge.connected = true;
      setStatus('connected');

      // Seed current property values, then subscribe for later changes.
      try {
        var props = WebCC.Properties;
        if (props) {
          console.log("code line 61: ", props);
          window.RecipeBridge.recipesJson = props.RecipeList;
          window.RecipeBridge.recipesPerPage = props.RecipesPerPage;
          window.RecipeBridge.language = props.Language;
          bridgeDispatch('UpdateRecipeList', props.RecipeList);
          bridgeDispatch('RecipesPerPage', props.RecipesPerPage);
          bridgeDispatch('Language', props.Language);
        }
      } catch (e) {
        console.warn('[RecipeList] property read failed:', e);
      }

      if (WebCC.onPropertyChanged) {
        WebCC.onPropertyChanged.subscribe(function (val) {
          console.log("changed:",val);
          switch (val.key) {
            case 'RecipeList':
              window.RecipeBridge.recipesJson = val.value;
              console.log(val.value);
              bridgeDispatch('UpdateRecipeList', val.value);
              break;
            case 'RecipesPerPage':
              if (val.value > 0) {
                window.RecipeBridge.recipesPerPage = val.value;
                bridgeDispatch('RecipesPerPage', val.value);
              }
              break;
            case 'Language':
              window.RecipeBridge.language = val.value;
              console.log(val.value);
              bridgeDispatch('Language', val.value);
              break;
          }
        });
      }

      if (window.RecipeBridge.onConnected) window.RecipeBridge.onConnected();
    } else {
      setStatus('connection failed');
    }
  },
  // contract (see also manifest.json)
  {
    // Methods
    methods: {
      /**
       * Diagnostic sink for the container: whatever it sends is logged here.
       *
       * Deliberately does not touch React — it exists to prove the
       * container -> control direction of the contract is wired, which is the
       * half that a fired event cannot demonstrate.
       */
      Print: function (data) {
        console.log('[RecipeList] Print called with', data);
        setStatus('Print: ' + data);
      },
      /**
       * Show a fixed message under the login button.
       *
       * Both arguments are passed through as one payload so React sees a
       * single state change: a code the UI maps to a localised string, and a
       * fade delay in milliseconds (0 or less means the message stays).
       */
      LoginMessage: function (messageNum, duration) {
        console.log('[RecipeList] LoginMessage called with', messageNum, duration);
        bridgeDispatch('LoginMessage', { code: Number(messageNum), duration: Number(duration) || 0 });
      },
      /**
       * Show a fixed message under the sign-up button.
       *
       * Same shape as LoginMessage but a separate method and a separate code
       * range, so the container can address either card without the two
       * message sets colliding.
       */
      RegisterMessage: function (messageNum, duration) {
        console.log('[RecipeList] RegisterMessage called with', messageNum, duration);
        bridgeDispatch('RegisterMessage', { code: Number(messageNum), duration: Number(duration) || 0 });
      },
      UpdateRecipeList: function (recipes) {
        console.log('[RecipeList] UpdateRecipeList called');
        window.RecipeBridge.recipesJson = recipes;
        bridgeDispatch('UpdateRecipeList', recipes);
      },
      ShowPage: function (pageNumber) {
        console.log('[RecipeList] ShowPage called with', pageNumber);
        bridgeDispatch('ShowPage', pageNumber);
      }
    },
    // Events
    events: ['onPressOnItem', 'onPressNewRecipe', 'onLanguageChange', 'onSignIn', 'onSignUp'],
    // Properties
    properties: {
      RecipeList: '[]',
      RecipesPerPage: 5,
      Language: 'en'
    }
  },
  // placeholder to include additional Unified dependencies (not used here)
  [],
  // connection timeout
  10000
);

console.log(WebCC)

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
    console.log('[RecipeList] standalone: event ' + name + ' not fired', payload);
    return false;
  }
  return WebCC.Events.fire(name, payload);
};
