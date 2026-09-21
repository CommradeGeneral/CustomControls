/*
 * Login handler for the LoginPage control.
 *
 * Requires bcrypt.js to be loaded (paste it above, or keep it in a global
 * script module). Run 00_probe.js once before trusting this.
 *
 * Replace "LoginPage_1" with whatever your screen item is actually called.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE MESSAGE CODES MEAN (they must match the control's manifest)
 *   LoginMessage(1, ms)  either username or password is invalid
 *   LoginMessage(2, ms)  username is badly formatted
 *   LoginMessage(0, ms)  withdraw the message (used on success)
 * ---------------------------------------------------------------------------
 */
export async function LoginPage_1_OnonSignIn(item, user) {
  var CONTROL = "LoginPage_1";
  /*
   * Set this from the probe's timings, not from a general recommendation.
   * Cost 12 is the usual advice for compiled bcrypt, but this is pure JS: it
   * measured ~780ms per hash on fast V8 here, and the WinCC engine is likely
   * slower still. Cost 10 (~190ms on the same machine) is the sane starting
   * point; run 00_probe.js and pick the highest cost that stays near 250ms.
   */
  var COST = 10;
  var MAX_ATTEMPTS = 5;       // Failures before the account locks.
  var LOCK_MINUTES = 15;

  /*
   * A bcrypt hash of a password nobody knows, used when the username does not
   * exist. Verifying against it costs the same as verifying a real one, so a
   * missing user and a wrong password take the same time. Without this, an
   * attacker can tell which usernames are real by timing the response alone.
   *
   * Its cost MUST match COST above. If they differ, the two paths take
   * different times again and the defence is undone - so if you change COST,
   * regenerate this with Bcrypt.hash(<any random string>, COST) and paste the
   * result here.
   */
  var DUMMY_HASH = "$2b$10$CJJPWTbOK6se3Z8bKK63/uE1aQhMtTJDGJf2opYLBY/Hht.vh4uVG";

  let conn = null;

  try {
    let credentials = JSON.parse(user);
    let username = String(credentials.username || "");
    let password = String(credentials.password || "");

    /*
     * Format check before touching the database. This is the one failure the
     * operator is told about specifically, because it is their typing error
     * rather than a credential mismatch - and it reveals nothing about which
     * accounts exist.
     */
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
      Screen.Items(CONTROL).LoginMessage(2, 4000);
      return;
    }
    if (password.length === 0) {
      Screen.Items(CONTROL).LoginMessage(1, 4000);
      return;
    }

    let connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";
    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    // Doubles any apostrophe so a username cannot break the statement.
    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let lookup = await conn.Execute(`
      SET NOCOUNT ON;
      SELECT id, username, display_name, password_hash, is_active, role,
             failed_attempts,
             CASE WHEN locked_until IS NOT NULL AND locked_until > GETDATE()
                  THEN 1 ELSE 0 END AS is_locked
      FROM app_user
      WHERE username = ${q(username)};
    `);

    let rows = lookup.Results[0].Rows;
    let keys = [];
    for (let k in rows) keys.push(k);
    let account = keys.length > 0 ? rows[keys[0]] : null;

    /*
     * Always run bcrypt, even when there is no such user. Returning early here
     * would make a missing username measurably faster than a wrong password,
     * which is exactly the leak DUMMY_HASH exists to close.
     */
    let storedHash = (account && account.password_hash)
      ? String(account.password_hash)
      : DUMMY_HASH;

    let passwordOk = Bcrypt.verify(password, storedHash);

    // A locked or disabled account cannot log in whatever it typed. Checked
    // after the hash so the timing does not give the state away either.
    let usable = account && account.is_active && !account.is_locked
                 && account.password_hash;

    if (!account || !usable || !passwordOk) {
      // Count the failure only against an account that really exists.
      if (account) {
        await conn.Execute(`
          SET NOCOUNT ON;
          UPDATE app_user
             SET failed_attempts = failed_attempts + 1,
                 locked_until = CASE
                   WHEN failed_attempts + 1 >= ${MAX_ATTEMPTS}
                   THEN DATEADD(minute, ${LOCK_MINUTES}, GETDATE())
                   ELSE locked_until END
           WHERE id = ${Number(account.id)};
        `);
      }

      /*
       * One message for every failure: no such user, wrong password, locked,
       * disabled. Telling them apart would turn the login screen into a tool
       * for discovering valid usernames.
       */
      Screen.Items(CONTROL).LoginMessage(1, 4000);
      HMIRuntime.Trace("onSignIn: failed for " + username);
      return;
    }

    // Success: clear the failure counter and stamp the login.
    await conn.Execute(`
      SET NOCOUNT ON;
      UPDATE app_user
         SET failed_attempts = 0, locked_until = NULL, last_login_at = GETDATE()
       WHERE id = ${Number(account.id)};
    `);

    /*
     * Opportunistic upgrade: if this hash was made at a lower cost than
     * current policy, re-hash now. This is the only moment the plaintext is
     * available, so accounts move to the new cost as people log in, without a
     * forced password reset.
     */
    let storedCost = Bcrypt.costOf(storedHash);
    if (storedCost > 0 && storedCost < COST) {
      try {
        let upgraded = Bcrypt.hash(password, COST);
        await conn.Execute(`
          SET NOCOUNT ON;
          UPDATE app_user SET password_hash = '${upgraded}'
           WHERE id = ${Number(account.id)};
        `);
        HMIRuntime.Trace("onSignIn: upgraded " + username +
                         " from cost " + storedCost + " to " + COST);
      } catch (e) {
        // A failed upgrade must not fail the login - they typed it correctly.
        HMIRuntime.Trace("onSignIn: upgrade failed: " + (e.message || e));
      }
    }

    Screen.Items(CONTROL).LoginMessage(0, 1);
    HMIRuntime.Trace("onSignIn: success for " + username +
                     " (role " + account.role + ")");

    /*
     * ------------------------------------------------------------------
     * Whatever "logged in" means in your project goes here: set a tag with
     * the user id and role, switch screens, and so on. account.role is the
     * integer from app_user.
     * ------------------------------------------------------------------
     */
    // HMIRuntime.Tags("CurrentUserId").Write(account.id);
    // HMIRuntime.Tags("CurrentUserRole").Write(account.role);
  }
  catch (e) {
    // Never report the internal reason to the operator: the same generic
    // failure, with the detail going to the trace instead.
    Screen.Items(CONTROL).LoginMessage(1, 4000);

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          HMIRuntime.Trace("onSignIn DB error state : " + errors[i].State);
          HMIRuntime.Trace("onSignIn DB error msg   : " + errors[i].Message);
        }
      }
    } else {
      HMIRuntime.Trace("onSignIn failed : " + (e.message || e));
    }
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}

/*
 * ---------------------------------------------------------------------------
 * CREATING AN ACCOUNT
 * ---------------------------------------------------------------------------
 * There is no sign-up path in the control any more, so accounts are made
 * administratively. Run this once from a button to create one:
 *
 *   let hash = Bcrypt.hash("the password", 12);
 *   HMIRuntime.Trace(hash);
 *
 * then INSERT that string into app_user.password_hash. Or do both at once:
 *
 *   let conn = await HMIRuntime.Database.CreateConnection(connectionstring);
 *   let hash = Bcrypt.hash("the password", 12);
 *   await conn.Execute(`
 *     SET NOCOUNT ON;
 *     INSERT INTO app_user (username, display_name, password_hash, role)
 *     VALUES (N'admin', N'Administrator', '${hash}', 9);
 *   `);
 *   conn.Close();
 *
 * The hash is plain ASCII, so it needs no N prefix and contains no quote that
 * could break the statement.
 * ---------------------------------------------------------------------------
 */
