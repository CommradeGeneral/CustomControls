export async function UserManager_1_OnonResetPassword(item, request) {
  let Bcrypt = Bt.Bcrypt;
  var CONTROL = "UserManager_1";

  var COST = 10;
  var MIN_LENGTH = 8;
  var ROLE_MANAGE_USERS = 2;
  var ROLE_ADMIN = 65535;

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let report = function (code, ms) {
    try {
      Screen.Items(CONTROL).EditUserMessage(code, ms);
    } catch (e) {
      HMIRuntime.Trace("onResetPassword: cannot reach " + CONTROL + " - " + (e.message || e));
    }
  };

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let username = String(payload.username || "").trim();
    let password = String(payload.password || "");
    let owner = String(payload.owner || "").trim();

    if (username.length === 0 || owner.length === 0) {
      report(4, 4000);
      return;
    }

    if (password.length < MIN_LENGTH) {
      report(2, 4000);
      return;
    }

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let lookup = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT
          (SELECT role FROM dbo.users WHERE username${cs} = ${q(owner)} AND is_active = 1) AS caller_role,
          (SELECT COUNT(*) FROM dbo.users WHERE username${cs} = ${q(username)}) AS target_exists,
          (SELECT owned_by FROM dbo.users WHERE username${cs} = ${q(username)}) AS target_owner;
      `);

    let rows = lookup.Results[0].Rows;
    let info = null;
    for (let k in rows) { info = rows[k]; break; }

    let callerRole = Number(info && info.caller_role) || 0;

    if ((callerRole & ROLE_MANAGE_USERS) === 0) {
      report(4, 4000);
      HMIRuntime.Trace("onResetPassword: role " + callerRole + " may not reset passwords");
      return;
    }

    if (!info || Number(info.target_exists) === 0) {
      report(1, 4000);
      return;
    }

    let targetOwner = info.target_owner ? String(info.target_owner) : "";
    if (callerRole !== ROLE_ADMIN && targetOwner !== owner) {
      report(4, 4000);
      HMIRuntime.Trace("onResetPassword: " + owner + " does not own " + username);
      return;
    }

    let hash = Bcrypt.hash(password, COST);

    await conn.Execute(`
        SET NOCOUNT ON;
        UPDATE dbo.users SET password_hash = '${hash}'
         WHERE username${cs} = ${q(username)};
      `);

    report(0, 3000);
    HMIRuntime.Trace("onResetPassword: reset for " + username + " by " + owner);
  }
  catch (e) {
    report(3, 4000);

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          HMIRuntime.Trace("onResetPassword DB error state : " + errors[i].State);
          HMIRuntime.Trace("onResetPassword DB error msg   : " + errors[i].Message);
        }
      }
    } else {
      HMIRuntime.Trace("onResetPassword failed : " + (e.message || e));
    }
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
