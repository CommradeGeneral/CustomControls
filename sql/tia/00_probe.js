/*
 * Run this FIRST, before using bcrypt.js for anything real.
 *
 * Two jobs:
 *   1. Report what the WinCC scripting engine actually exposes, so we know
 *      whether a better option than hand-rolled JS crypto is available.
 *   2. Run bcrypt's self-test, which checks the implementation against
 *      published vectors and measures how slow a hash is on this machine.
 *
 * Paste bcrypt.js above this, or put both in the same global script module.
 * Wire this to a button, run it once, and send me the trace output.
 *
 * Nothing here writes to the database or changes any state.
 */
export function ProbeCrypto() {
  var say = function (m) { HMIRuntime.Trace("[probe] " + m); };

  say("---- engine capability probe ----");

  // What kind of JS engine is this, and what is in scope?
  var has = function (name, value) {
    say(name + ": " + (typeof value === "undefined" ? "NOT AVAILABLE" : typeof value));
  };

  has("crypto", typeof crypto !== "undefined" ? crypto : undefined);
  has("require", typeof require !== "undefined" ? require : undefined);
  has("Uint8Array", typeof Uint8Array !== "undefined" ? Uint8Array : undefined);
  has("ArrayBuffer", typeof ArrayBuffer !== "undefined" ? ArrayBuffer : undefined);
  has("BigInt", typeof BigInt !== "undefined" ? BigInt : undefined);
  has("TextEncoder", typeof TextEncoder !== "undefined" ? TextEncoder : undefined);
  has("Promise", typeof Promise !== "undefined" ? Promise : undefined);
  has("ActiveXObject", typeof ActiveXObject !== "undefined" ? ActiveXObject : undefined);

  // A real CSPRNG would be better than Math.random for salts.
  if (typeof crypto !== "undefined" && crypto) {
    say("crypto.getRandomValues: " + (crypto.getRandomValues ? "YES" : "no"));
    say("crypto.subtle: " + (crypto.subtle ? "YES" : "no"));
  }

  // Does the engine support modern syntax? If these throw, the engine is old
  // and bcrypt.js is written in ES5 precisely for that reason.
  try { eval("var f = (x) => x + 1; f(1);"); say("arrow functions: yes"); }
  catch (e) { say("arrow functions: NO (ES5 engine)"); }
  try { eval("let z = 1; const y = 2;"); say("let/const: yes"); }
  catch (e) { say("let/const: NO (ES5 engine)"); }

  // Raw arithmetic speed, as a rough guide to what bcrypt will cost.
  var t0 = (new Date()).getTime();
  var acc = 0;
  for (var i = 0; i < 2000000; i++) acc = (acc + i) >>> 0;
  var t1 = (new Date()).getTime();
  say("2M integer ops: " + (t1 - t0) + "ms");

  say("---- bcrypt self-test ----");

  if (typeof Bcrypt === "undefined") {
    say("Bcrypt is not defined - paste bcrypt.js above this script.");
    return;
  }

  // Checks correctness against published vectors and reports timings per cost.
  var ok = Bcrypt.selfTest(say);

  say("---- result ----");
  say(ok
    ? "bcrypt works here. Pick the cost whose timing above is nearest 250ms."
    : "bcrypt FAILED its self-test. Do not use it; send me this output.");
}
