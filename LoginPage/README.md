# LoginPage

A WinCC Unified Custom Web Control: a sign-in card, in English or Arabic.

Built with React + Vite and shipped as a single inlined HTML file, because the
runtime serves controls from `/screen_modules/` where relative asset URLs do
not resolve.

## Layout

```
manifest.json          the contract TIA reads: methods, events, properties
src/code.js            contract owner - a classic script, no bundler
src/App.jsx            composition only; holds no state of its own
src/hooks/useBridge.js everything the container owns
src/components/        the card and the language dropdown
scripts/package-control.mjs  zips control/ as {GUID}.zip into TIA_PROJ
```

`code.js` runs in `<head>` before React is parsed and calls `WebCC.start` at
top level. React never takes part in the handshake — it mounts afterwards and
only talks to `window.LoginBridge`, so adding a framework cannot affect
contract registration. Do not move `WebCC.start` into a module or an effect.

## Contract

| Method | Effect |
| --- | --- |
| `Print(data)` | Log to the console and the status line. |
| `LoginMessage(messageNumber, timeout)` | Under the sign-in button: 1 = bad credentials, 2 = malformed username, anything else clears. |

A `timeout` greater than zero fades the message after that many milliseconds;
zero or less leaves it up.

| Event | Payload |
| --- | --- |
| `onSignIn` | JSON string of `{username, password}` |
| `onLanguageChange` | the chosen language code, to write back to `Language` |

The single property is `Language` (`en` or `ar`); any other value keeps the
last valid one. The dropdown does not set it directly — it fires
`onLanguageChange` and waits for the container to write the property back.

## Running it

```
npm run dev      # standalone in a browser, no container
npm run build    # writes control/index.html, then packages it
npm run lint
```

Standalone, `WebCC` is undefined, so `code.js` takes its standalone path and
the UI renders immediately rather than waiting on a handshake that will never
settle. The container's methods can be driven from the devtools console:

```js
LoginBridge.showLoginMessage(1, 3000)
```

`npm run package` zips `control/` as `{GUID}.zip` into the path from `TIA_PROJ`
in the repo-root `.env` (a project-local `.env` overrides it).
