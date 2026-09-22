export async function LoginPage_1_OnonSignIn(item, user) {
  let Bcrypt = Bt.Bcrypt;
  var CONTROL = "Login_1";

  var COST = 10;

  var DUMMY_HASH = "$2b$10$CJJPWTbOK6se3Z8bKK63/uE1aQhMtTJDGJf2opYLBY/Hht.vh4uVG";

  var TAG_USERNAME = "CurrentUsername";
  var TAG_DISPLAY_NAME = "CurrentDisplayName";
  var TAG_ROLE = "CurrentUserRole";

  var USER_MANAGER = "";

  var HOME_SCREEN = "";

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let conn = null;

  try {
    let credentials = JSON.parse(user);
    let username = String(credentials.username || "");
    let password = String(credentials.password || "");

    /*if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
      Screen.Items(CONTROL).LoginMessage(2, 4000);
      return;
    }
    if (password.length === 0) {
      Screen.Items(CONTROL).LoginMessage(1, 4000);
      return;
    }*/

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let lookup = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT username, display_name, password_hash, is_active, role, owned_by
        FROM dbo.users
        WHERE username${cs} = ${q(username)};
      `);

    let rows = lookup.Results[0].Rows;
    let keys = [];
    for (let k in rows) keys.push(k);
    let account = keys.length > 0 ? rows[keys[0]] : null;

    let storedHash = (account && account.password_hash)
      ? String(account.password_hash)
      : DUMMY_HASH;

    let passwordOk = Bcrypt.verify(password, storedHash);

    let usable = account && account.is_active && account.password_hash;

    if (!account || !usable || !passwordOk) {
      Screen.Items(CONTROL).LoginMessage(1, 4000);
      HMIRuntime.Trace("onSignIn: failed for " + username);
      return;
    }

    await conn.Execute(`
        SET NOCOUNT ON;
        UPDATE dbo.users SET last_login_at = GETDATE()
         WHERE username = ${q(account.username)};
      `);

    let storedCost = Bcrypt.costOf(storedHash);
    if (storedCost > 0 && storedCost < COST) {
      try {
        let upgraded = Bcrypt.hash(password, COST);
        await conn.Execute(`
            SET NOCOUNT ON;
            UPDATE dbo.users SET password_hash = '${upgraded}'
             WHERE username = ${q(account.username)};
          `);
        HMIRuntime.Trace("onSignIn: upgraded " + username +
          " from cost " + storedCost + " to " + COST);
      } catch (e) {
        HMIRuntime.Trace("onSignIn: upgrade failed: " + (e.message || e));
      }
    }

    Screen.Items(CONTROL).LoginMessage(0, 1);

    let userRole = Number(account.role);
    let displayName = account.display_name
      ? String(account.display_name)
      : String(account.username);

    /*writeTag(TAG_USERNAME, username);
    writeTag(TAG_DISPLAY_NAME, displayName);
    writeTag(TAG_ROLE, userRole);

    setControlProperty(USER_MANAGER, "Username", username);
    setControlProperty(USER_MANAGER, "Role", userRole);*/

    HMIRuntime.Trace("onSignIn: success for " + username +
      " (role " + userRole + ")");

    /*if (HOME_SCREEN) {
      HMIRuntime.UI.SysFct.ActivateScreen(HOME_SCREEN, 0);
    }*/
  }
  catch (e) {
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

function writeTag(name, value) {
  if (!name) return;
  try {
    HMIRuntime.Tags(name).Write(value);
  } catch (e) {
    HMIRuntime.Trace("onSignIn: could not write tag '" + name + "': " +
      (e.message || e));
  }
}

function setControlProperty(item, property, value) {
  if (!item) return;
  try {
    Screen.Items(item)[property] = value;
  } catch (e) {
    HMIRuntime.Trace("onSignIn: could not set " + item + "." + property +
      " (not on a loaded screen?): " + (e.message || e));
  }
}

/*
 * CREATING AN ACCOUNT
 *
 *   let hash = Bcrypt.hash("the password", 10);
 *   HMIRuntime.Trace(hash);
 *
 *   let conn = await HMIRuntime.Database.CreateConnection(connectionstring);
 *   let hash = Bcrypt.hash("the password", 10);
 *   await conn.Execute(`
 *     SET NOCOUNT ON;
 *     INSERT INTO dbo.users (username, display_name, password_hash, is_active, role)
 *     VALUES (N'admin', N'Administrator', '${hash}', 1, 65535);
 *   `);
 *   conn.Close();
 */
