export async function UserManager_1_OnonChangePassword(item, request) {
  let Bcrypt = Bt.Bcrypt;
  var CONTROL = "UserManager_1";

  var COST = 10;
  var MIN_LENGTH = 8;

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let username = String(payload.username || "");
    let current = String(payload.current || "");
    let next = String(payload.next || "");

    if (username.length === 0 || current.length === 0) {
      Screen.Items(CONTROL).ChangePasswordMessage(1, 4000);
      return;
    }

    if (next.length < MIN_LENGTH || next === current) {
      Screen.Items(CONTROL).ChangePasswordMessage(2, 4000);
      return;
    }

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let lookup = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT username, password_hash, is_active
        FROM dbo.users
        WHERE username${cs} = ${q(username)};
      `);

    let rows = lookup.Results[0].Rows;
    let keys = [];
    for (let k in rows) keys.push(k);
    let account = keys.length > 0 ? rows[keys[0]] : null;

    let usable = account && account.is_active && account.password_hash;

    if (!usable || !Bcrypt.verify(current, String(account.password_hash))) {
      Screen.Items(CONTROL).ChangePasswordMessage(1, 4000);
      HMIRuntime.Trace("onChangePassword: rejected for " + username);
      return;
    }

    let hash = Bcrypt.hash(next, COST);

    await conn.Execute(`
        SET NOCOUNT ON;
        UPDATE dbo.users SET password_hash = '${hash}'
         WHERE username = ${q(account.username)};
      `);

    Screen.Items(CONTROL).ChangePasswordMessage(0, 4000);
    HMIRuntime.Trace("onChangePassword: changed for " + username);
  }
  catch (e) {
    Screen.Items(CONTROL).ChangePasswordMessage(3, 4000);

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          HMIRuntime.Trace("onChangePassword DB error state : " + errors[i].State);
          HMIRuntime.Trace("onChangePassword DB error msg   : " + errors[i].Message);
        }
      }
    } else {
      HMIRuntime.Trace("onChangePassword failed : " + (e.message || e));
    }
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
